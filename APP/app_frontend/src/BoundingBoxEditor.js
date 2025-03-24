import React, { useState, useEffect, useRef } from "react";

const BoundingBoxEditor = ({ imageSrc, boxes, onBoxesChange }) => {
  const canvasRef = useRef(null);
  const [currentBox, setCurrentBox] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      drawBoxes();
    };

    img.src = imageSrc;
  }, [imageSrc, boxes]);

  const drawBoxes = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    boxes.forEach(box => {
      ctx.strokeStyle = box.color || "#FF0000";
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
    });
  };

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentBox({ x, y, width: 0, height: 0 });
    setIsDrawing(true);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setCurrentBox(prev => ({
      ...prev,
      width: mouseX - prev.x,
      height: mouseY - prev.y
    }));
  };

  const handleMouseUp = () => {
    if (currentBox && Math.abs(currentBox.width) > 5 && Math.abs(currentBox.height) > 5) {
      onBoxesChange([...boxes, currentBox]);
    }
    setIsDrawing(false);
    setCurrentBox(null);
  };

  return (
    <div className={styles.canvasContainer}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
    </div>
  );
};

export default BoundingBoxEditor;