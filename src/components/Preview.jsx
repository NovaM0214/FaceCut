import React, { useRef, useEffect, useState } from 'react';
import { Slider, Button, Space, Grid } from '@arco-design/web-react';

const Preview = ({ xOffset, yOffset, faceBoxSize, onXChange, onYChange, onFaceBoxSizeChange, onReset }) => {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [previewFace, setPreviewFace] = useState(null);

  useEffect(() => {
    const img = new Image();
    img.src = '/yulantu.png';
    img.onload = async () => {
      imageRef.current = img;
      setIsImageLoaded(true);

      const response = await fetch('/yulantu.png');
      const blob = await response.blob();
      const file = new File([blob], 'yulantu.png', { type: 'image/png' });

      const formData = new FormData();
      formData.append('file', file);

      try {
        const detectResponse = await fetch('http://127.0.0.1:5000/detect', {
          method: 'POST',
          body: formData,
        });
        const faces = await detectResponse.json();
        if (faces && faces.length > 0) {
          const largestFace = faces.sort((a, b) => (b.bbox[2] - b.bbox[0]) - (a.bbox[2] - a.bbox[0]))[0];
          setPreviewFace(largestFace);
        }
      } catch (error) {
        console.error("Error detecting face in preview image:", error);
      }
    };
  }, []);

  useEffect(() => {
    if (!isImageLoaded || !canvasRef.current || !previewFace) {
      return;
    }

    const img = imageRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const [fx, fy, fx2, fy2] = previewFace.bbox;
    const faceWidth = fx2 - fx;
    const faceHeight = fy2 - fy;

    const scale = faceBoxSize / faceWidth;

    const scaledFaceCenterX = (fx + faceWidth / 2) * scale;
    const scaledFaceCenterY = (fy + faceHeight / 2) * scale;

    const canvasCenterX = canvas.width / 2;
    const canvasCenterY = canvas.height / 2;

    const baseDrawX = canvasCenterX - scaledFaceCenterX;
    const baseDrawY = canvasCenterY - scaledFaceCenterY;

    const drawX = baseDrawX + xOffset;
    const drawY = baseDrawY + yOffset;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, drawX, drawY, img.naturalWidth * scale, img.naturalHeight * scale);

    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 1000, 1000);

    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2;
    const faceBoxGuideX = (canvas.width - faceBoxSize) / 2 + xOffset;
    const faceBoxGuideY = (canvas.height - faceBoxSize) / 2 + yOffset;
    ctx.strokeRect(faceBoxGuideX, faceBoxGuideY, faceBoxSize, faceBoxSize);

  }, [isImageLoaded, previewFace, xOffset, yOffset, faceBoxSize]);

  return (
    <>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <canvas ref={canvasRef} width={1000} height={1000} style={{width: '100%', height: 'auto'}}></canvas>
        </div>
        <Space direction="vertical" style={{ width: '100%' }}>
            <Grid.Row align='center'>
                <Grid.Col span={4}>X 偏移</Grid.Col>
                <Grid.Col span={20}><Slider showInput value={xOffset} onChange={onXChange} min={-300} max={300} /></Grid.Col>
            </Grid.Row>
            <Grid.Row align='center'>
                <Grid.Col span={4}>Y 偏移</Grid.Col>
                <Grid.Col span={20}><Slider showInput value={yOffset} onChange={onYChange} min={-300} max={300} /></Grid.Col>
            </Grid.Row>
            <Grid.Row align='center'>
                <Grid.Col span={4}>面部框</Grid.Col>
                <Grid.Col span={20}><Slider showInput value={faceBoxSize} onChange={onFaceBoxSizeChange} min={200} max={500} /></Grid.Col>
            </Grid.Row>
            <Button onClick={onReset}>重置</Button>
        </Space>
    </>
  );
};

export default Preview;