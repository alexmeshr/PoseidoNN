import React, { useState } from "react";
import axios from 'axios';
import styles from "./App.module.css";

const App = () => {
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({});
  const [boundingBoxes, setBoundingBoxes] = useState({});

  // Загрузка изображений
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    const imageFiles = files.map((file) => ({
      id: URL.createObjectURL(file),
      file,
      boxes: [],
    }));
    setImages((prev) => [...prev, ...imageFiles]);
  };

  // Удаление всех изображений
  const handleDeleteImages = () => {
    setImages([]);
    setSelectedImage(null);
    setStats({});
    setProgress(0);
    setBoundingBoxes({});
  };

 // Отправка изображений на сервер для обработки
  const handleProcessImages = async () => {
    setIsProcessing(true);

    const formData = new FormData();
    images.forEach((img, index) => {
      fetch(img)
        .then((res) => res.blob())
        .then((blob) => {
          formData.append("files", blob, `image_${index}.jpg`);

          if (index === images.length - 1) {
            startDetection(formData);
          }
        });
    });
  };

  // Запуск детекции и отслеживание прогресса
  const startDetection = async (formData) => {
    try {
      const response = await axios.post("http://localhost:8008/detect/", formData);
      const { task_id } = response.data;
      pollProgress(task_id);
    } catch (error) {
      console.error("Ошибка при отправке изображений:", error);
      setIsProcessing(false);
    }
  };

// Периодический запрос для отслеживания прогресса
const pollProgress = (taskId) => {
  const interval = setInterval(async () => {
    try {
      const response = await axios.get(`http://localhost:8008/progress/${taskId}`);
      const { progress, stats, done, results } = response.data;

      setProgress(progress);

      if (done) {
        clearInterval(interval);
        setIsProcessing(false);
        setStats(stats);

        // Сопоставляем рамки с изображениями
        const updatedBoxes = {};
        images.forEach((img, index) => {
          updatedBoxes[img.id] = results[index] || [];
        });

        setBoundingBoxes(updatedBoxes);
      }
    } catch (error) {
      console.error("Ошибка при получении прогресса:", error);
      clearInterval(interval);
      setIsProcessing(false);
    }
  }, 1000);
};



  return (
    <div className={styles.container}>
      {/* Верхняя панель */}
      <div className={styles.topPanel}>
        <div className={styles.appTitle}>OBJECT DETECTION APP</div>
        {!isProcessing ? (
          <div className={styles.buttonGroup}>
            {images.length === 0 ? (
              <label className={styles.button}>
                Загрузить изображения
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </label>
            ) : (
              <>
                <button onClick={handleDeleteImages} className={styles.button}>
                  Удалить
                </button>
                <label className={styles.button}>
                  Загрузить еще
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                  />
                </label>
                <button onClick={handleProcessImages} className={styles.button}>
                  Запустить
                </button>
              </>
            )}
          </div>
        ) : (
          <progress
            className={styles.progressBar}
            value={progress}
            max="100"
          ></progress>
        )}
      </div>

      {/* Основное содержимое */}
      <div className={styles.mainContent}>
        {/* Левая панель (список изображений) */}
        <div className={styles.leftPanel}>
        {images.length > 0 ? (
          images.map((img) => (
              <img
                key={img.id}
                src={img.id}
                alt="thumbnail"
                className={`${styles.thumbnail} ${selectedImage === img.id ? styles.activeThumbnail : ""}`}
                onClick={() => setSelectedImage(img.id)}
              />
            ))
          ) : (
      <p className={styles.noImagesText}>Нет загруженных изображений</p>
    )}
        </div>

        {/* Центральная панель (выбранное изображение) */}
        <div className={styles.centerPanel}>
          {selectedImage ? (
            <div className={styles.imageWrapper}>
              <img src={selectedImage} alt="Selected" className={styles.activeImage} />
              {boundingBoxes[selectedImage]?.map((box, idx) => (
                <div
                  key={idx}
                  className={styles.bbox}
                  style={{
                    left: `${box.bbox[0]}px`,
                    top: `${box.bbox[1]}px`,
                    width: `${box.bbox[2] - box.bbox[0]}px`,
                    height: `${box.bbox[3] - box.bbox[1]}px`,
                  }}
                >
                  {box.class}
                </div>
              ))}
            </div>
          ) : (
            <p>Выберите изображение</p>
          )}
        </div>

        {/* Правая панель (статистика) */}
        <div className={styles.rightPanel}>
          <div className={styles.statsTitle}>Статистика</div>
          {Object.entries(stats).map(([label, count], index) => (
            <div key={index} className={styles.statsItem}>
              {label}: {count}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;


