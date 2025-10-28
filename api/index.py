from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
from insightface.app import FaceAnalysis

app = Flask(__name__)
CORS(app)

app.add_url_rule('/', 'health_check', lambda: 'ok')

fa = FaceAnalysis(providers=['CPUExecutionProvider'])
fa.prepare(ctx_id=0, det_size=(640, 640))

@app.route('/detect', methods=['POST'])
def detect_faces():
    if 'file' not in request.files:
        return jsonify([])
    file = request.files['file']
    img = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_COLOR)
    faces = fa.get(img)
    
    results = []
    for face in faces:
        results.append({
            'bbox': [int(x) for x in face.bbox],
            'kps': [[int(x[0]), int(x[1])] for x in face.kps],
            'det_score': float(face.det_score),
        })
    
    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True, port=5000)