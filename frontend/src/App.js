import React, { useState, useEffect, useCallback } from 'react';
import EXIF from 'exif-js';
import { useDropzone } from 'react-dropzone';
import * as faceapi from 'face-api.js';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import './App.css';

function App() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [processedImages, setProcessedImages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelError, setModelError] = useState('');
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  // Load face detection models
  useEffect(() => {
    const loadModels = async () => {
      try {
          await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri('/models')
          ]);
          setModelLoaded(true);
        } catch (error) {
          console.error('Failed to load models:', error);
          setModelError('模型加载失败，请刷新页面重试');
        }
    };

    loadModels();
  }, []);

  // Process images with face detection and cropping
  const processImages = useCallback(async () => {
    if (!modelLoaded || uploadedFiles.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    const newProcessedImages = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      try {
        const processedImage = await processImage(file);
        newProcessedImages.push({
          originalName: file.name,
          url: processedImage
        });
      } catch (error) {
        console.error('Error processing image:', error);
      }
      setProgress(Math.round(((i + 1) / uploadedFiles.length) * 100));
    }

    setProcessedImages(newProcessedImages);
    setIsProcessing(false);
  }, [uploadedFiles, modelLoaded, offsetX, offsetY]);

  // Process single image
  const processImage = async (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);

      img.onload = async () => {
        try {
          // Detect faces first
          const detections = await faceapi.detectSingleFace(img);
          if (!detections) {
            throw new Error('No face detected');
          }

          // Get EXIF orientation data
          const orientation = await new Promise((resolve) => {
            EXIF.getData(img, function() {
              resolve(EXIF.getTag(this, 'Orientation') || 1);
            });
          });
          console.log('Image orientation:', orientation);

          // Get face dimensions before orientation adjustment
          let { x, y, width, height } = detections.box;
          let imgWidth = img.width;
          let imgHeight = img.height;

          // Adjust coordinates based on EXIF orientation
          switch(orientation) {
            case 2: // Horizontal flip
              x = imgWidth - (x + width);
              break;
            case 3: // 180° rotate
              x = imgWidth - (x + width);
              y = imgHeight - (y + height);
              break;
            case 4: // Vertical flip
              y = imgHeight - (y + height);
              break;
            case 5: // Horizontal flip + 90° rotate
              [width, height] = [height, width];
              [x, y] = [imgHeight - (y + height), x];
              [imgWidth, imgHeight] = [imgHeight, imgWidth];
              break;
            case 6: // 90° rotate
              [width, height] = [height, width];
              [x, y] = [y, imgWidth - (x + width)];
              [imgWidth, imgHeight] = [imgHeight, imgWidth];
              break;
            case 7: // Horizontal flip + 270° rotate
              [width, height] = [height, width];
              [x, y] = [imgHeight - y, imgWidth - (x + width)];
              [imgWidth, imgHeight] = [imgHeight, imgWidth];
              break;
            case 8: // 270° rotate
              [width, height] = [height, width];
              [x, y] = [imgHeight - (y + height), x];
              [imgWidth, imgHeight] = [imgHeight, imgWidth];
              break;
            default: // Normal orientation
              break;
          }

          // Create canvas for cropping
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 1000;
            canvas.height = 1000;

            // Calculate face center from adjusted coordinates
            const faceCenterX = x + width / 2;
            const faceCenterY = y + height / 2;
            const faceSize = Math.max(width, height);
            const faceScale = 300 / faceSize;

            // Debug logging for face centering
            console.log('Face Centering Debug:', {
                originalImageWidth: img.width,
                originalImageHeight: img.height,
                exifOrientation: orientation,
                adjustedFaceX: x,
                adjustedFaceY: y,
                adjustedFaceWidth: width,
                adjustedFaceHeight: height,
                calculatedFaceCenterX: faceCenterX,
                calculatedFaceCenterY: faceCenterY,
                targetFaceSize: 300,
                appliedScale: faceScale
              });

            // Calculate exact position to center face in 1000x1000 canvas
            const canvasCenter = 500; // Center point of output canvas
            const imgX = canvasCenter - (faceCenterX * faceScale) + offsetX;
            const imgY = canvasCenter - (faceCenterY * faceScale) + offsetY;

            // Calculate center offsets for debugging
            const centerOffsetX = Math.abs(imgX + faceCenterX * faceScale - canvasCenter);
            const centerOffsetY = Math.abs(imgY + faceCenterY * faceScale - canvasCenter);

            // Final validation and debug information
            console.log('Face Position Debug:', {
            originalDetection: { x, y, width, height },
            correctedFaceCenter: { x: faceCenterX, y: faceCenterY },
            scaling: { faceSize, faceScale, targetSize: 300 },
            positioning: { imgX, imgY, canvasCenter },
            finalFaceSize: { width: width * faceScale, height: height * faceScale },
            validation: {
              isCentered: centerOffsetX < 1 && centerOffsetY < 1,
              isCorrectSize: Math.abs(width * faceScale - 300) < 1
            }
          });
          
          // Critical validation checks
          console.assert(Math.abs(width * faceScale - 300) < 1, `Face size validation failed: ${(width * faceScale).toFixed(1)}px (expected 300px)`);
          console.assert(Math.abs(imgX + faceCenterX * faceScale - canvasCenter) < 1, `Horizontal centering failed: Offset ${(imgX + faceCenterX * faceScale - canvasCenter).toFixed(1)}px`);
          
          // Validation checks
          console.assert(Math.abs(width * faceScale - 300) < 2,
            `Face size validation failed: ${(width * faceScale).toFixed(2)}px (expected 300px)`);
          console.assert(Math.abs(imgX + faceCenterX * faceScale - canvasCenter) < 2,
            `Horizontal centering validation failed: ${(imgX + faceCenterX * faceScale).toFixed(2)}px (expected ${canvasCenter}px)`);

          // Draw entire image scaled to fit canvas
          ctx.drawImage(
            img, 0, 0, img.width, img.height,
            imgX, imgY, img.width * faceScale, img.height * faceScale
          );

          // Draw face centered in 300x300 area (for reference, can be removed)


          const resultUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(img.src);
          resolve(resultUrl);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = reject;
    });
  };

  // Handle file drop
  const onDrop = useCallback((acceptedFiles) => {
    setUploadedFiles(acceptedFiles);
    setProcessedImages([]);
  }, []);

  // Remove uploaded file
  const removeFile = (index) => {
    const newFiles = [...uploadedFiles];
    newFiles.splice(index, 1);
    setUploadedFiles(newFiles);
    if (newFiles.length === 0) setProcessedImages([]);
  };

  // Download processed images as ZIP
  const downloadZIP = () => {
    const zip = new JSZip();
    processedImages.forEach(img => {
      const base64Data = img.url.replace(/^data:image\/png;base64,/, '');
      const newName = img.originalName.replace(/\.[^/.]+$/, "") + ".png";
      zip.file(newName, base64Data, { base64: true });
    });

    zip.generateAsync({ type: 'blob' }).then(content => {
      saveAs(content, 'face-cropped-images.zip');
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: 'image/*',
    multiple: true
  });

  return (
    <div className="App">
      <h1>面部识别裁剪工具</h1>
      <div className="container">
        {/* Dropzone Area */}
        <div className="dropzone-container">
          <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} />
            {isDragActive ? (
              <p>释放文件开始上传</p>
            ) : (
              <p>点击或拖拽图片到此处上传</p>
            )}
          </div>

          {uploadedFiles.length > 0 && (
            <div className="file-list">
              <h3>已上传文件 ({uploadedFiles.length})</h3>
              <div className="file-list-content">
                {modelError && <div className="error-message">{modelError}</div>}
                <ul>
                  {uploadedFiles.map((file, index) => (
                    <li key={index}>
                      {file.name}
                      <button 
                        className="delete-btn"
                        onClick={() => removeFile(index)}
                      >
                        删除
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ padding: '10px 20px', backgroundColor: '#f0f0f0', borderRadius: '8px', margin: '10px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ minWidth: '120px' }}>X 轴偏移: {offsetX}</label>
                  <input
                    type="range"
                    min="-300"
                    max="300"
                    value={offsetX}
                    onChange={(e) => setOffsetX(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <label style={{ minWidth: '120px' }}>Y 轴偏移: {offsetY}</label>
                  <input
                    type="range"
                    min="-300"
                    max="300"
                    value={offsetY}
                    onChange={(e) => setOffsetY(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <button
                className="process-btn"
                onClick={processImages}
                disabled={isProcessing || !modelLoaded || uploadedFiles.length === 0}
              >
                {isProcessing ? '处理中...' : '开始处理'}
              </button>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {isProcessing && (
          <div className="progress-container">
            <div
              className="progress-bar"
              style={{ width: `${progress}%` }}
            ></div>
            <span className="progress-text">{progress}%</span>
          </div>
        )}

        {/* Preview Section */}
        {processedImages.length > 0 && (
          <div className="preview-container">
            <h3>处理结果 ({processedImages.length})</h3>
            <div className="preview-grid">
              {processedImages.map((img, index) => (
                <div key={index} className="preview-item">
                  <img src={img.url} alt={`Processed ${index}`} />
                  <p>{img.originalName}</p>
                </div>
              ))}
            </div>
            <button className="download-btn" onClick={downloadZIP}>
              下载全部图片
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
