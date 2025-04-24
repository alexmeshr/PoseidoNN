import React, { useState, useRef, useEffect } from "react";
import axios from 'axios';
import styles from "./App.module.css";

const usePreventUnload = (shouldWarn) => {
  useEffect(() => {
    if (!shouldWarn) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'У вас есть несохраненные изменения. Вы уверены, что хотите уйти?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldWarn]);
};


const App = () => {
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({});
  const [boundingBoxes, setBoundingBoxes] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [tempBoxes, setTempBoxes] = useState({});
  const [selectedClass, setSelectedClass] = useState("Нить");
  const startCoords = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  usePreventUnload(hasUnsavedChanges);


  const maxWidth = Math.floor(window.innerWidth * 0.5); // Максимальная ширина
  const maxHeight = Math.floor(window.innerHeight * 0.5); // Максимальная высота

const classNames = {
  Нить: "Нить",
  Пленка: "Пленка",
  Обломок: "Обломок",
  Сфера: "Сфера",
  Гранула: "Гранула",
};


useEffect(() => {
  if (selectedImage && Array.isArray(boundingBoxes[selectedImage])) {
    setTempBoxes([...boundingBoxes[selectedImage]]);
  } else {
    setTempBoxes([]);
  }
  //console.log(tempBoxes)
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


const resizeImage = (file, maxWidth, maxHeight) => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const originalWidth = img.width;
        const originalHeight = img.height;
        let width = originalWidth;
        let height = originalHeight;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          const resizedFile = new File([blob], file.name, { type: file.type });
          resolve({
            file: resizedFile,
            originalWidth,
            originalHeight,
            resizedWidth: width,
            resizedHeight: height
          });
        }, file.type);
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
};


  // Загрузка изображений
const handleFileUpload = async (event) => {
  const files = Array.from(event.target.files);

  const resizedImages = await Promise.all(
    files.map(async (file) => {
      const resized = await resizeImage(file, maxWidth, maxHeight);
      return {
        id: URL.createObjectURL(resized.file),
        file: resized.file,
        originalHeight: resized.originalHeight,
        originalWidth : resized.originalWidth,
        resizedWidth : resized.resizedWidth,
        resizedHeight: resized.resizedHeight,
        boxes: [],
      };
    })
  );

  setImages((prev) => [...prev, ...resizedImages]);
};

  // Удаление всех изображений
const handleDeleteImages = () => {
  const isConfirmed = window.confirm("Вы точно хотите удалить все изображения? Это действие нельзя отменить.");

  if (isConfirmed) {
    setImages([]);
    setSelectedImage(null);
    setStats({});
    setProgress(0);
    setBoundingBoxes({});
    setHasUnsavedChanges(false);
  }
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
  setHasUnsavedChanges(true);
};

// Отмена изменений
const handleCancel = () => {
  setTempBoxes(Array.isArray(boundingBoxes[selectedImage]) ? [...boundingBoxes[selectedImage]] : []);
  setIsEditing(false);
};



const loadImage = (file) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = URL.createObjectURL(file);
  });
};

// для парсинга json
const handleCheckAnnotationFolder = async (event) => {
  const files = Array.from(event.target.files);
  const jsonFiles = files.filter(f => f.name.endsWith('.json'));

// Сортируем JSON-файлы по дате изменения (последний созданный будет первым в массиве)
const sortedJsonFiles = jsonFiles.sort((a, b) => {
  return new Date(b.lastModified) - new Date(a.lastModified);
});

  const jsonFile = sortedJsonFiles[0];
  const jsonImageFiles = files.filter((f) => f.type.startsWith('image/'));

  if (!jsonFile) {
    alert("Файл .json с разметкой не найден");
    return;
  }

  if (jsonImageFiles.length === 0) {
    alert("Изображения не найдены в папке");
    return;
  }
  const jsonText = await jsonFile.text();
  const annotations = JSON.parse(jsonText); // {"IMG_0001.JPG": [...]}

   setIsLoading(true);
  setProgress(0);

const newBoundingBoxes = {};
  const totalImages = jsonImageFiles.length;
  const imageFiles = [];

  for (let i = 0; i < totalImages; i++) {
    const file = jsonImageFiles[i];
    const boxesFromJson = annotations[file.name] || [];

    const resized = await resizeImage(file, maxWidth, maxHeight);
    const resizedFile = resized.file;
    const originalWidth = resized.originalWidth;
    const originalHeight = resized.originalHeight;

    const scaleX = resized.resizedWidth / originalWidth;
    const scaleY = resized.resizedHeight / originalHeight;

    const scaledBoxes = boxesFromJson.flatMap((box) => {
  // Отфильтровываем ненужные боксы
  if (box.class === 'dirt') return [];
  if (box.class === 'fragment' && box.confidence < 0.8) return [];

  // Переводим классы
  const classMap = {
    fragment: 'Обломок',
    fiber: 'Нить',
    pellet: 'Гранула',
  };

  const translatedClass = classMap[box.class] || box.class;

  // Переведённые координаты
  const x = box.x * scaleX;
  const y = box.y * scaleY;
  const width = box.width * scaleX;
  const height = box.height * scaleY;
  const widthHalf = Math.floor(width / 2);
  const heightHalf = Math.floor(height / 2);

  return [{
    bbox: [x - widthHalf, y - heightHalf, x + widthHalf, y + heightHalf],
    class: translatedClass,
    confidence: box.confidence,
    detection_id: box.detection_id,
  }];
});

    const imageId = URL.createObjectURL(resizedFile);
    newBoundingBoxes[imageId] = scaledBoxes;
    //console.log(resizedFile.name)
    imageFiles.push({
      id: imageId,
      file: resizedFile,
      originalHeight: originalHeight,
      originalWidth : originalWidth,
      resizedWidth : resized.resizedWidth,
      resizedHeight: resized.resizedHeight,
      boxes: [], // или scaledBoxes
    });

    // Обновляем прогресс
    setProgress(Math.round(((i + 1) / totalImages) * 100));
  }

  setImages((prev) => [...prev, ...imageFiles]);
  setBoundingBoxes((prev) => ({ ...prev, ...newBoundingBoxes }));

  const newStats = {};
  Object.values(newBoundingBoxes).forEach((boxesArray) => {
    if (Array.isArray(boxesArray)) {
      boxesArray.forEach((box) => {
        newStats[box.class] = (newStats[box.class] || 0) + 1;
      });
    }
  });

  setStats(newStats);
  setProgress(0);
  setIsLoading(false);
};

const downloadJson = (jsonStr, filename) => {
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
};

const exportAnnotationsToJson = async () => {
  const annotations = {};

  images.forEach((img) => {
    const imageId = img.id;
    const fileName = img.file.name;
    const boxes = boundingBoxes[imageId] || [];

    const scaleX = img.originalWidth / img.resizedWidth;
    const scaleY = img.originalHeight / img.resizedHeight;

    annotations[fileName] = boxes.map((box) => {
      const [x1, y1, x2, y2] = box.bbox;

      const centerX = ((x1 + x2) / 2) * scaleX;
      const centerY = ((y1 + y2) / 2) * scaleY;
      const width = Math.abs(x2 - x1) * scaleX;
      const height = Math.abs(y2 - y1) * scaleY;

      return {
        x: centerX,
        y: centerY,
        width,
        height,
        confidence: box.confidence,
        class: box.class,
        detection_id: box.detection_id,
      };
    });
  });

  const jsonStr = JSON.stringify(annotations, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: "annotations.json",
        types: [{
          description: "JSON Files",
          accept: { "application/json": [".json"] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Ошибка при сохранении файла:", err);
      }
      // если ошибка, всё равно делаем фолбэк
    }
  }

  // Фолбэк на <a> — если API недоступен или возникла ошибка
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = "annotations.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
              <option value="Нить">Нить</option>
              <option value="Пленка">Пленка</option>
              <option value="Обломок">Обломок</option>
              <option value="Сфера">Сфера</option>
              <option value="Гранула">Гранула</option>
            </select>
            <div className={styles.buttonGroup}>
              <button onClick={handleCancel} className={styles.button}>Отменить</button>
              <button onClick={handleSave} className={styles.button}>Сохранить</button>
            </div>
          </div>
          ) : (
          <div className={styles.buttonGroup}>
            {images.length === 0 ? (
             !isLoading ? (
            <>
            <label className={styles.button}title="Выберите папку, в которой находятся изображения и json-файл с разметкой">
              Загрузить разметку
              <input
                type="file"
                webkitdirectory="true"
                directory=""
                multiple
                onChange={handleCheckAnnotationFolder}
                style={{ display: "none" }}
              />
            </label>

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
              </>
              ):(
                  <progress
                className={styles.progressBar}
                value={progress}
                max="100"
              ></progress>
              )
            ) : (
              <>
                <button onClick={handleDeleteImages} className={styles.button}>
                  Удалить все
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
               <button onClick={exportAnnotationsToJson} className={styles.button}>Сохранить разметку</button>
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


