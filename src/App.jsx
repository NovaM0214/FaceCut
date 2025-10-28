import React, { useState, useEffect } from 'react';
import { IconDelete } from '@arco-design/web-react/icon';
import JSZip from 'jszip';
import { 
    Layout, 
    Upload, 
    Card, 
    Slider, 
    Button, 
    Space, 
    Grid, 
    Progress, 
    Modal,
    Message,
    Typography,
    Avatar
} from '@arco-design/web-react';
import '@arco-design/web-react/dist/css/arco.css';
import Preview from './components/Preview';
import './App.css';

const { Header, Content } = Layout;

function App() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [processedImages, setProcessedImages] = useState([]);
  const [xOffset, setXOffset] = useState(0);
  const [yOffset, setYOffset] = useState(0);
  const [faceBoxSize, setFaceBoxSize] = useState(250);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');

  const handleUploadChange = (fileList) => {
    const newFileList = fileList.map(file => {
        if (file.originFile && !file.url) {
            file.url = URL.createObjectURL(file.originFile);
        }
        return file;
    });
    setUploadedFiles(newFileList);
  };

  useEffect(() => {
    return () => {
        uploadedFiles.forEach(file => {
            if (file.url && file.url.startsWith('blob:')) {
                URL.revokeObjectURL(file.url);
            }
        });
    };
  }, [uploadedFiles]);

  const resetOffsets = () => {
    setXOffset(0);
    setYOffset(0);
    setFaceBoxSize(250);
  };

  const handleCrop = async () => {
    if (uploadedFiles.length === 0) {
        Message.error('请先上传图片');
        return;
    }

    setProcessing(true);
    setProgress(0);
    const newProcessedImages = [];
    const newErrors = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      setCurrentFile(file.name);
      try {
        const formData = new FormData();
        formData.append('file', file.originFile);

        const response = await fetch('/api/detect', {
          method: 'POST',
          body: formData,
        }).catch(e => {
          newErrors.push('无法连接到后端服务。');
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const faces = await response.json();

        if (faces.length > 0) {
          const detection = faces.sort((a, b) => b.bbox[2] - a.bbox[2])[0];
          const [x, y, x2, y2] = detection.bbox;
          const width = x2 - x;
          const height = y2 - y;

          const img = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const img = new Image();
              img.src = e.target.result;
              img.onload = () => resolve(img);
            };
            reader.readAsDataURL(file.originFile);
          });

          const canvas = document.createElement('canvas');
          canvas.width = 1000;
          canvas.height = 1000;
          const ctx = canvas.getContext('2d');

          const faceCenterX = x + width / 2;
          const faceCenterY = y + height / 2;

          const targetFaceSize = faceBoxSize;
          const scale = targetFaceSize / width;

          const drawX = 500 - (faceCenterX * scale) + xOffset;
          const drawY = 500 - (faceCenterY * scale) + yOffset;

          ctx.drawImage(img, drawX, drawY, img.width * scale, img.height * scale);
          const dataUrl = canvas.toDataURL('image/png');
          const newName = file.name.substring(0, file.name.lastIndexOf('.')) + '.png';
          newProcessedImages.push({ name: newName, dataUrl, uid: file.uid });
        } else {
          newErrors.push(`在 ${file.name} 中未检测到人脸`);
        }
      } catch (error) {
        newErrors.push(`处理 ${file.name} 失败。`);
      }
      setProgress(Math.floor(((i + 1) / uploadedFiles.length) * 100));
    }

    setProcessedImages(newProcessedImages);
    setProcessing(false);
    setCurrentFile('');

    if (newErrors.length > 0) {
        newErrors.forEach(err => Message.error(err));
    }
    if (newProcessedImages.length > 0) {
        Message.success('所有图片处理完成！');
    }
  };

  const downloadAll = () => {
    if (processedImages.length === 0) {
        Message.error('没有可下载的图片');
        return;
    }
    if (processedImages.length === 1) {
      const link = document.createElement('a');
      link.href = processedImages[0].dataUrl;
      link.download = processedImages[0].name;
      link.click();
    } else {
      const zip = new JSZip();
      processedImages.forEach(image => {
        const base64Data = image.dataUrl.split(',')[1];
        const newName = image.name.substring(0, image.name.lastIndexOf('.')) + '.png';
        zip.file(newName, base64Data, { base64: true });
      });

      zip.generateAsync({ type: 'blob' }, (metadata) => {
        setProgress(metadata.percent);
      }).then(content => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = '裁剪后的图片.zip';
        link.click();
        setProgress(0);
      });
    }
  };

  const clearGenerated = () => {
    if (window.confirm('您确定要清除所有生成的图片吗？')) {
      setProcessedImages([]);
    }
  };

  const clearUploadedFiles = () => {
    if (window.confirm('您确定要清除所有已上传的图片吗？')) {
      setUploadedFiles([]);
    }
  };

  return (
    <Layout className="layout" style={{ minHeight: '100vh' }}>
      <Header style={{
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '80px',
        backgroundColor: '#1677ff',
      }}>
        <div className='logo' />
        <Typography.Title heading={4} style={{ margin: 0, color: 'white' }} className="header-title">批量面部裁剪工具</Typography.Title>
      </Header>
      <Content style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: 'calc(100vh - 80px)' }}>
        <div style={{ maxWidth: '1600px', width: '100%' }}>
            <Grid.Row gutter={24}>
                <Grid.Col span={8}>
                    <div style={{ border: '1px solid var(--border-color, #e8e8e8)', borderRadius: '4px', height: '750px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg-2, white)' }}>
                        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color, #e8e8e8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <Typography.Title heading={6} style={{ margin: 0 }}>上传图片</Typography.Title>
                            <Button
                                onClick={clearUploadedFiles}
                                type="text"
                                disabled={uploadedFiles.length === 0}
                            >
                                清除全部
                            </Button>
                        </div>
                        <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ padding: '10px 20px 0 20px', flexShrink: 0 }}>
                                <Upload
                                    drag
                                    multiple
                                    showUploadList={false}
                                    fileList={uploadedFiles}
                                    onChange={handleUploadChange}
                                    customRequest={(options) => {
                                        const { file, onSuccess } = options;
                                        onSuccess();
                                    }}
                                    accept='image/jpeg,image/png,image/webp'
                                >
                          
                                </Upload>
                            </div>
                            <div style={{ overflowY: 'auto', flex: '1 1 auto', padding: '20px' }}>
                                <Grid.Row gutter={[16, 16]}>
                                    {uploadedFiles.map(file => (
                                        <Grid.Col span={6} key={file.uid}>
                                            <div className="upload-list-item-wrapper">
                                                <img
                                                    alt={file.name}
                                                    src={file.url}
                                                />
                                                <div className="upload-list-item-actions">
                                                    <Button key="delete" type="text" icon={<IconDelete />} onClick={() => handleRemove(file)} />
                                                </div>
                                            </div>
                                        </Grid.Col>
                                    ))}
                                </Grid.Row>
                            </div>
                        </div>
                        <div style={{ padding: '20px', borderTop: '1px solid var(--border-color, #e8e8e8)', flexShrink: 0 }}>
                            <Button 
                                type="primary" 
                                onClick={handleCrop} 
                                loading={processing} 
                                disabled={uploadedFiles.length === 0}
                                style={{ width: '100%' }}
                            >
                                {processing ? `正在处理...` : '开始裁剪'}
                            </Button>
                            {processing && <Progress percent={progress} style={{ marginTop: 16 }}/>}
                        </div>
                    </div>
                </Grid.Col>
                <Grid.Col span={8}>
                    <div style={{ border: '1px solid var(--border-color, #e8e8e8)', borderRadius: '4px', height: '750px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg-2, white)' }}>
                        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color, #e8e8e8)', flexShrink: 0 }}>
                            <Typography.Title heading={6} style={{ margin: 0 }}>预览和调整</Typography.Title>
                        </div>
                        <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '20px' }}>
                            <Preview 
                                xOffset={xOffset} 
                                yOffset={yOffset} 
                                faceBoxSize={faceBoxSize} 
                                onXChange={setXOffset} 
                                onYChange={setYOffset} 
                                onFaceBoxSizeChange={setFaceBoxSize} 
                                onReset={resetOffsets} 
                            />
                        </div>
                    </div>
                </Grid.Col>
                <Grid.Col span={8}>
                    <Card 
                        title='处理结果'
                        extra={
                            <Space>
                                <Button type="primary" onClick={downloadAll} disabled={processedImages.length === 0}>下载全部</Button>
                                <Button onClick={clearGenerated} disabled={processedImages.length === 0}>清除全部</Button>
                            </Space>
                        }
                        style={{ height: '750px' }}
                    >
                        <div style={{ height: '670px', overflowY: 'auto' }}>
                            <Grid.Row gutter={[16, 16]}>
                                {processedImages.map((image, index) => (
                                    <Grid.Col span={12} key={index}>
                                        <Card
                                            hoverable
                                            cover={<img alt={image.name} src={image.dataUrl} style={{ width: '100%', height: 'auto' }} />}
                                        >
                                            <Card.Meta title={image.name} />
                                        </Card>
                                    </Grid.Col>
                                ))}
                            </Grid.Row>
                        </div>
                    </Card>
                </Grid.Col>
            </Grid.Row>
        </div>
      </Content>
    </Layout>
  );
}

export default App;
