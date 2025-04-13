import React, { useState, useRef, useEffect } from "react";
import axios from 'axios';
import styles from "./App.module.css";

import BBoxEditor from './components/BBoxEditor';
import './styles.css';

const App = () => {
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({});
  const [boundingBoxes, setBoundingBoxes] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [tempBoxes, setTempBoxes] = useState({});
  const [selectedClass, setSelectedClass] = useState("class1");
  const startCoords = useRef(null);

  const [imageData, setImageData] = useState(null);
  const fileInputRef = useRef(null);

  // Загрузка JSON-файла с разметкой
  const handleJsonUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = JSON.parse(event.target.result);
      setImageData(data);
      // Автоматически выбираем первое изображение
      const firstImage = Object.keys(data)[0];
      setCurrentImage(firstImage);
    };
    reader.readAsText(file);
  };

  // Сохранение изменённой разметки
  const handleSave = () => {
    const dataStr = JSON.stringify(imageData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'updated_annotations.json';
    a.click();
  };

  return (
    <div className="app">
      <h1>Редактор разметки</h1>
      <input
        type="file"
        accept=".json"
        onChange={handleJsonUpload}
        ref={fileInputRef}
      />
      {imageData && currentImage && (
        <>
          <BBoxEditor
            imageName={currentImage}
            annotations={imageData[currentImage]}
            onUpdate={(updatedAnnotations) => {
              setImageData({
                ...imageData,
                [currentImage]: updatedAnnotations,
              });
            }}
          />
          <button onClick={handleSave}>Сохранить разметку</button>
        </>
      )}
    </div>
  );
}
  
const classNames = {
  class1: "Нить",
  class2: "Пленка",
  class3: "Обломок",
  class4: "Сфера",
  class5: "Гранула",
};

useEffect(() => {
  if (selectedImage && Array.isArray(boundingBoxes[selectedImage])) {
    setTempBoxes([...boundingBoxes[selectedImage]]);
  } else {
    setTempBoxes([]);
  }
  console.log(tempBoxes)
}, [selectedImage, boundingBoxes]);

useEffect(() => {
  if (selectedImage && Array.isArray(boundingBoxes[selectedImage])){
  const newStats = {};
  Object.values(boundingBoxes).forEach((boxesArray) => {
    if (Array.isArray(boxesArray)) {
      boxesArray.forEach((box) => {
        newStats[box.class] = (newStats[box.class] || 0) + 1;
      });
    }
  });

  setStats(newStats);
  }
}, [boundingBoxes]);

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

  // Начало создания рамки
  const handleMouseDown = (e) => {
    if (!isEditing || e.button !== 0) return;
    const rect = e.target.getBoundingClientRect();
    startCoords.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Завершение создания рамки
  const handleMouseUp = (e) => {
    if (!isEditing || e.button !== 0 || !startCoords.current) return;
    const rect = e.target.getBoundingClientRect();
    const endCoords = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    if (startCoords.current.x !== endCoords.x && startCoords.current.y !== endCoords.y) {
      const newBox = {
        bbox: [
          Math.min(startCoords.current.x, endCoords.x),
          Math.min(startCoords.current.y, endCoords.y),
          Math.max(startCoords.current.x, endCoords.x),
          Math.max(startCoords.current.y, endCoords.y),
        ],
        class: selectedClass,
      };
      setTempBoxes((prev) => [...prev, newBox]);
    }
    startCoords.current = null;
  };

// Удаление рамки
const handleRightClick = (e) => {
  if (!isEditing) return;
  e.preventDefault();

  const rect = e.target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  setTempBoxes((prev) => prev.filter(
    (box) =>
      x < box.bbox[0] ||
      x > box.bbox[2] ||
      y < box.bbox[1] ||
      y > box.bbox[3]
  ));
};

// Сохранение изменений
const handleSave = () => {
  setBoundingBoxes((prev) => ({ ...prev, [selectedImage]: [...tempBoxes] }));
  setIsEditing(false);
};

// Отмена изменений
const handleCancel = () => {
  setTempBoxes(Array.isArray(boundingBoxes[selectedImage]) ? [...boundingBoxes[selectedImage]] : []);
  setIsEditing(false);
};



  return (
    <div className={styles.container}>
      {/* Верхняя панель */}
      <div className={styles.topPanel}>
        <div className={styles.appTitle}>ДЕТЕКЦИЯ МИКРОПЛАСТИКА</div>
        {!isProcessing ? (
          isEditing ? (
          <div className={styles.editingControls}>
            <select
              className={styles.classSelector}
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="class1">Нить</option>
              <option value="class2">Пленка</option>
              <option value="class3">Обломок</option>
              <option value="class4">Сфера</option>
              <option value="class5">Гранула</option>
            </select>
            <div className={styles.buttonGroup}>
              <button onClick={handleCancel} className={styles.button}>Отменить</button>
              <button onClick={handleSave} className={styles.button}>Сохранить</button>
            </div>
          </div>
          ) : (
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
               <button onClick={() => setIsEditing(true)} className={styles.button}>Редактировать</button>
              </>
            )}
          </div>
        )) : (
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
          images.map((img) => {

      const boxes = boundingBoxes[img.id] || [];
      const stats = {};

      boxes.forEach((box) => {
        stats[box.class] = (stats[box.class] || 0) + 1;
      });

      return (
        <div key={img.id} className={styles.thumbnailWrapper} onClick={() => setSelectedImage(img.id)}>
          <div className={styles.thumbnailContainer}>
            <img
              src={img.id}
              alt="thumbnail"
              className={`${styles.thumbnail} ${selectedImage === img.id ? styles.activeThumbnail : ""}`}
              ref={(el) => {
                if (el) {
                  el.onload = () => {
                    el.dataset.width = el.naturalWidth; // Оригинальная ширина
                    el.dataset.height = el.naturalHeight; // Оригинальная высота
                  };
                }
              }}
            />

            {/* Статистика прямо на миниатюре */}
            <div className={styles.thumbnailStats}>
              {Object.entries(stats).map(([label, count]) => (
                <div key={label} className={styles.statsItem}>
                  {classNames[label] || label}: {count}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    })
  ) : (
      <p className={styles.noImagesText}>Нет загруженных изображений</p>
    )}
        </div>

        {/* Центральная панель (выбранное изображение) */}
        <div className={styles.centerPanel}>
          {selectedImage ? (
            <div
              className={styles.imageWrapper}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onContextMenu={(e) => {
                handleRightClick(e)
              }}
            >
              <img src={selectedImage} alt="Selected" className={styles.activeImage} onDragStart={(e) => e.preventDefault()}/>
              {tempBoxes.map((box, idx) => (
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
                  {classNames[box.class] || box.class}
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
              {classNames[label] || label}: {count}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;


