let detector = null;
let isInitialized = false;
let playerIndex = 2;

async function initializeDetector() {
    try {
        console.log('开始加载 TensorFlow.js MoveNet 模型...');

        const tfModule = await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.esm.min.js');
        console.log('tfModule 加载完成:', typeof tfModule);

        const poseDetectionModule = await import('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.esm.js');
        console.log('poseDetectionModule 加载完成');
        console.log('poseDetectionModule 导出内容:', Object.keys(poseDetectionModule));

        const poseDetection = poseDetectionModule.default || poseDetectionModule;
        console.log('poseDetection 最终对象:', typeof poseDetection);

        if (!poseDetection || typeof poseDetection.createDetector !== 'function') {
            console.error('poseDetection 模块无效');
            throw new Error('poseDetection 模块无效');
        }

        const detectorConfig = {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
            enableSmoothing: true,
            inputResolution: { width: 640, height: 480 },
            scoreThreshold: 0.2
        };

        console.log('创建 MoveNet 检测器...');
        detector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            detectorConfig
        );

        console.log('检测器创建成功');
        isInitialized = true;
        self.postMessage({ type: 'INITIALIZED', playerIndex: playerIndex });

    } catch (error) {
        console.error('初始化检测器失败:', error);
        self.postMessage({ type: 'ERROR', playerIndex: playerIndex, error: error.message });
    }
}

self.onmessage = async (event) => {
    try {
        const { type, data, playerIndex: eventPlayerIndex } = event.data;

        if (eventPlayerIndex) {
            playerIndex = eventPlayerIndex;
        }

        switch (type) {
            case 'INITIALIZE':
                await initializeDetector();
                break;
            case 'PROCESS_FRAME':
                if (detector && isInitialized && data) {
                    const poses = await detector.estimatePoses(data);
                    self.postMessage({
                        type: 'POSE_RESULTS',
                        playerIndex: playerIndex,
                        results: { poseLandmarks: poses.length > 0 ? poses[0].keypoints : null }
                    });
                }
                break;
            case 'STOP':
                if (detector) {
                    detector = null;
                }
                isInitialized = false;
                self.close();
                break;
        }
    } catch (error) {
        console.error('处理消息失败:', error);
        self.postMessage({ type: 'ERROR', playerIndex: playerIndex, error: error.message });
    }
};
