import React, { useState, useEffect, useRef } from "react";

const BoundingBoxEditor = ({ 
  imageSrc, 
  boxes, 
  onBoxesChange,
  selectedClass = "fiber",
  colors = { fiber: "#FF0000", fragment: "#00FF00" }
}) => {
  const canvasRef = useRef(null);
  const [currentBox, setCurrentBox] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedBox, setSelectedBox] = useState(null);
  const [scale, setScale] = useState(1);
  
  // Инициализация canvas и отрисовка
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      // Сохраняем оригинальные размеры
      canvas.dataset.originalWidth = img.width;
      canvas.dataset.originalHeight = img.height;
      
      // Масштабируем для отображения
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      drawBoxes();
    };

    img.src = imageSrc;
  }, [imageSrc, boxes, scale]);

  // Отрисовка всех bounding boxes
  const drawBoxes = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Отрисовка всех боксов
    boxes.forEach((box, index) => {
      const isSelected = selectedBox === index;
      ctx.strokeStyle = isSelected ? "#FFFF00" : (box.color || colors[box.class]);
      ctx.lineWidth = isSelected ? 3 : 2;
      
      const scaledBox = scaleBox(box);
      ctx.strokeRect(scaledBox.x, scaledBox.y, scaledBox.width, scaledBox.height);
      
      // Подпись класса
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(box.class, scaledBox.x + 5, scaledBox.y + 15);
    });

    // Отрисовка текущего рисуемого бокса
    if (currentBox) {
      ctx.strokeStyle = colors[selectedClass];
      ctx.lineWidth = 2;
      const scaledBox = scaleBox(currentBox);
      ctx.strokeRect(scaledBox.x, scaledBox.y, scaledBox.width, scaledBox.height);
    }
  };

  // Масштабирование координат
  const scaleBox = (box) => ({
    x: box.x * scale,
    y: box.y * scale,
    width: box.width * scale,
    height: box.height * scale
  });

  // Обработка клика для выбора бокса
  const handleBoxClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    // Поиск кликнутого бокса
    const clickedBoxIndex = boxes.findIndex(box => 
      x >= box.x && x <= box.x + box.width &&
      y >= box.y && y <= box.y + box.height
    );
    
    setSelectedBox(clickedBoxIndex >= 0 ? clickedBoxIndex : null);
  };

  // Удаление выбранного бокса
  const deleteSelectedBox = () => {
    if (selectedBox !== null) {
      const newBoxes = [...boxes];
      newBoxes.splice(selectedBox, 1);
      onBoxesChange(newBoxes);
      setSelectedBox(null);
    }
  };

  // Начало рисования нового бокса
  const startDrawing = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    setCurrentBox({ 
      x, 
      y, 
      width: 0, 
      height: 0, 
      class: selectedClass,
      color: colors[selectedClass]
    });
    setIsDrawing(true);
    setSelectedBox(null);
  };

  // Изменение размера рисуемого бокса
  const updateDrawingBox = (e) => {
    if (!isDrawing) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / scale;
    const mouseY = (e.clientY - rect.top) / scale;

    setCurrentBox(prev => ({
      ...prev,
      width: mouseX - prev.x,
      height: mouseY - prev.y
    }));
  };

  // Завершение рисования
  const finishDrawing = () => {
    if (currentBox && Math.abs(currentBox.width) > 5 && Math.abs(currentBox.height) > 5) {
      onBoxesChange([...boxes, currentBox]);
    }
    setIsDrawing(false);
    setCurrentBox(null);
  };

  // Изменение класса выбранного бокса
  const changeSelectedClass = (newClass) => {
    if (selectedBox !== null) {
      const updatedBoxes = [...boxes];
      updatedBoxes[selectedBox] = {
        ...updatedBoxes[selectedBox],
        class: newClass,
        color: colors[newClass]
      };
      onBoxesChange(updatedBoxes);
    }
  };

  return (
    <div className="canvas-container">
      <div className="controls">
        <select 
          value={selectedClass} 
          onChange={(e) => setSelectedClass(e.target.value)}
        >
          <option value="fiber">Fiber</option>
          <option value="fragment">Fragment</option>
        </select>
        
        <button onClick={deleteSelectedBox} disabled={selectedBox === null}>
          Delete Selected
        </button>
        
        <input 
          type="range" 
          min="0.5" 
          max="2" 
          step="0.1" 
          value={scale}
          onChange={(e) => setScale(parseFloat(e.target.value))}
        />
        <span>Zoom: {scale.toFixed(1)}x</span>
      </div>
      
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={updateDrawingBox}
        onMouseUp={finishDrawing}
        onClick={handleBoxClick}
      />
      
      {selectedBox !== null && (
        <div className="box-properties">
          <h3>Box Properties</h3>
          <select
            value={boxes[selectedBox].class}
            onChange={(e) => changeSelectedClass(e.target.value)}
          >
            <option value="fiber">Fiber</option>
            <option value="fragment">Fragment</option>
          </select>
          <p>Position: {boxes[selectedBox].x.toFixed(1)}, {boxes[selectedBox].y.toFixed(1)}</p>
          <p>Size: {boxes[selectedBox].width.toFixed(1)} × {boxes[selectedBox].height.toFixed(1)}</p>
        </div>
      )}
    </div>
  );
};

export default BoundingBoxEditor;
