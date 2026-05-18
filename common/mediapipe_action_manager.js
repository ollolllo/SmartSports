/**
 * MediaPipe Pose 姿态动作识别框架
 * 
 * 模块划分：
 * 1. PoseDetector - 姿态检测模块，负责从视频帧检测骨骼关键点
 * 2. ActionRecognizer - 动作识别模块，负责从关键点识别玩家动作
 * 3. PoseDrawer - 姿态绘制工具类
 * 4. GameFramework - 游戏框架类，整合所有模块
 * 
 * @author SmartSports Team
 * @version 2.1.0
 */

// 使用条件声明避免重复定义错误
if (typeof LANDMARK_INDEX === 'undefined') {
    var LANDMARK_INDEX = {
        NOSE: 0,              // 鼻子
        LEFT_EYE_INNER: 1,    // 左眼内角
        LEFT_EYE: 2,          // 左眼
        LEFT_EYE_OUTER: 3,    // 左眼外角
        RIGHT_EYE_INNER: 4,   // 右眼内角
        RIGHT_EYE: 5,         // 右眼
        RIGHT_EYE_OUTER: 6,   // 右眼外角
        LEFT_EAR: 7,          // 左耳
        RIGHT_EAR: 8,         // 右耳
        MOUTH_LEFT: 9,        // 嘴左角
        MOUTH_RIGHT: 10,      // 嘴右角
        LEFT_SHOULDER: 11,    // 左肩
        RIGHT_SHOULDER: 12,   // 右肩
        LEFT_ELBOW: 13,       // 左肘
        RIGHT_ELBOW: 14,      // 右肘
        LEFT_WRIST: 15,       // 左手腕
        RIGHT_WRIST: 16,      // 右手腕
        LEFT_PINKY: 17,       // 左小指
        RIGHT_PINKY: 18,      // 右小指
        LEFT_INDEX: 19,       // 左食指
        RIGHT_INDEX: 20,      // 右食指
        LEFT_THUMB: 21,       // 左拇指
        RIGHT_THUMB: 22,      // 右拇指
        LEFT_HIP: 23,         // 左髋
        RIGHT_HIP: 24,        // 右髋
        LEFT_KNEE: 25,        // 左膝
        RIGHT_KNEE: 26,       // 右膝
        LEFT_ANKLE: 27,       // 左踝
        RIGHT_ANKLE: 28,      // 右踝
        LEFT_HEEL: 29,        // 左脚后跟
        RIGHT_HEEL: 30,       // 右脚后跟
        LEFT_FOOT_INDEX: 31,  // 左脚趾
        RIGHT_FOOT_INDEX: 32   // 右脚趾
    };
}

// 使用条件声明避免重复定义错误
if (typeof ACTION_TYPE === 'undefined') {
    var ACTION_TYPE = {
        STANDING: '站立',
        RIGHT_HAND_RAISED: '举起右手',
        LEFT_HAND_RAISED: '举起左手',
        BOTH_HANDS_RAISED: '举起双手',
        HANDS_OPEN: '张开双手',
        JUMPING: '跳起来',
        HANDS_ON_HEAD: '双手抱头',
        RIGHT_HAND_EXTENDED: '伸开右手',
        LEFT_HAND_EXTENDED: '伸开左手',
        INCOMPLETE: '未检测到完整姿态',
        NO_PERSON: '未检测到人'
    };
}

// ============================================
// 模块1: PoseDetector - 姿态检测模块
// ============================================

/**
 * 姿态检测器类
 * 负责从视频帧中检测人体姿态关键点
 */
class PoseDetector {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {boolean} options.selfieMode - 是否为自拍模式（镜像）
     * @param {number} options.modelComplexity - 模型复杂度 (0, 1, 2)
     * @param {number} options.minDetectionConfidence - 检测置信度阈值
     * @param {number} options.minTrackingConfidence - 跟踪置信度阈值
     */
    constructor(options = {}) {
        this.options = {
            selfieMode: true,
            modelComplexity: 1,
            poseDetectInterval: 0,
            poseInputScale: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
            ...options
        };

        this.lastDetectTime = 0;

        this.poses = [];           // 存储多个 Pose 实例（支持多玩家）
        this.playerConfigs = [];    // 玩家检测区域配置
        this.videoElement = null;   // 视频元素
        this.isRunning = false;     // 是否正在运行
        this.onResultCallback = null; // 结果回调
        
        // Canvas 缓存，避免重复创建
        this.canvasCache = [];
        
        // 姿态历史记录，用于平滑处理
        this.poseHistory = {};
        this.maxPoseHistory = 3;
        
        // 最后更新时间
        this.lastUpdateTime = {};

        // 事件监听器
        this.listeners = {};
    }

    /**
     * 添加事件监听器
     * @param {string} eventName - 事件名称
     * @param {Function} callback - 回调函数
     */
    on(eventName, callback) {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(callback);
    }

    /**
     * 触发事件
     * @param {string} eventName - 事件名称
     * @param {*} data - 事件数据
     */
    emit(eventName, data) {
        if (this.listeners[eventName]) {
            this.listeners[eventName].forEach(callback => callback(data));
        }
    }

    /**
     * 初始化检测器
     * @param {Array} playerConfigs - 玩家检测区域配置
     * @param {HTMLElement} videoElement - 视频元素
     */
    async init(playerConfigs, videoElement) {
        this.playerConfigs = playerConfigs;
        this.videoElement = videoElement;
        
        // 初始化姿态历史
        playerConfigs.forEach(config => {
            this.poseHistory[config.id] = [];
            this.lastUpdateTime[config.id] = 0;
        });
        
        // 为每个玩家创建独立的 Pose 实例
        for (let i = 0; i < playerConfigs.length; i++) {
            const playerId = playerConfigs[i].id;
            const pose = new Pose({
                locateFile: (file) => `mediapipe/${file}`
            });
            
            await pose.setOptions({
                modelComplexity: this.options.modelComplexity,
                smoothLandmarks: true,
                enableSegmentation: false,
                smoothSegmentation: false,
                minDetectionConfidence: this.options.minDetectionConfidence,
                minTrackingConfidence: this.options.minTrackingConfidence,
                selfieMode: this.options.selfieMode,
                maxNumPoses: 1
            });
            
            // 设置 onResults 回调（与 fruit4player.html 一致）
            const currentPlayerId = playerId;
            const currentIndex = i;
            pose.onResults((results) => {
                results.playerId = currentPlayerId;
                results.playerIndex = currentIndex;
                this.onPoseResults(results);
            });
            
            // 初始化 MediaPipe Pose
            await pose.initialize();
            
            // 创建 canvas 并设置 ctx（与 fruit4player.html 一致）
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            canvas.ctx = canvas.getContext('2d');
            
            this.poses.push(pose);
            this.canvasCache.push(canvas);
            console.log(`Pose 实例 ${i + 1} (玩家${playerId}) 初始化完成`);
        }
        
        console.log(`PoseDetector 初始化完成，创建了 ${this.poses.length} 个 Pose 实例`);
        this.emit('initialized', { playerCount: this.poses.length });
    }

    /**
     * 开始检测
     * @param {Function} callback - 检测结果回调函数
     */
    start(callback) {
        if (this.isRunning) {
            console.warn('PoseDetector 已经在运行中');
            return;
        }
        
        this.onResultCallback = callback;
        this.isRunning = true;
        this.detect();
        console.log('PoseDetector 开始运行');
        this.emit('started');
    }

    /**
     * 停止检测
     */
    stop() {
        this.isRunning = false;
        console.log('PoseDetector 已停止');
        this.emit('stopped');
    }

    /**
     * 处理姿态检测结果（与 fruit4player.html 一致）
     * @param {Object} results - MediaPipe 返回的检测结果
     */
    onPoseResults(results) {
        const currentPlayer = results.playerId;
        let currentPose = null;
        
        console.log(`[DEBUG] onPoseResults - playerId: ${currentPlayer}, has poseLandmarks: ${!!results.poseLandmarks}`);
        
        if (results.poseLandmarks) {
            currentPose = results.poseLandmarks;
            console.log(`[DEBUG] onPoseResults - landmarks count: ${currentPose.length}`);
        }
        
        if (currentPose && currentPose[0]) {
            const adjustedPose = currentPose;
            
            // 添加到历史记录
            if (!this.poseHistory[currentPlayer]) {
                this.poseHistory[currentPlayer] = [];
            }
            this.poseHistory[currentPlayer].push(adjustedPose);
            if (this.poseHistory[currentPlayer].length > this.maxPoseHistory) {
                this.poseHistory[currentPlayer].shift();
            }
            
            // 平滑处理
            const smoothedPose = this.smoothPose(this.poseHistory[currentPlayer]);
            
            // 构建结果对象
            const result = {
                playerId: currentPlayer,
                playerIndex: results.playerIndex,
                landmarks: smoothedPose,
                worldLandmarks: results.poseWorldLandmarks || [],
                detectionArea: this.playerConfigs[results.playerIndex]?.detectionArea || {}
            };
            
            // 更新最后更新时间
            this.lastUpdateTime[currentPlayer] = performance.now();
            
            // 触发事件
            this.emit('results', [result]);
            
            // 调用回调
            if (this.onResultCallback) {
                this.onResultCallback([result]);
            }
        }
    }

    /**
     * 主检测循环（与 fruit4player.html 一致）
     */
    async detect() {


        const now = performance.now();
        const poseDetectInterval = this.options.poseDetectInterval || 0;
        
        if (poseDetectInterval > 0 && now - this.lastDetectTime < poseDetectInterval) {
            this.animationFrame = requestAnimationFrame(() => this.detect());
            return;
        }
        
        this.lastDetectTime = now;


        if (!this.isRunning || !this.videoElement) {
            console.log('PoseDetector.detect skipped:', {
                isRunning: this.isRunning,
                videoElement: !!this.videoElement
            });
            return;
        }

        try {
            // 检查视频是否已加载
            if (this.videoElement.readyState < 2) {
                console.log('PoseDetector.detect - video not ready');
                requestAnimationFrame(() => this.detect());
                return;
            }

            const fullWidth = this.videoElement.videoWidth || 640;
            const fullHeight = this.videoElement.videoHeight || 480;
 

            if (fullWidth === 0 || fullHeight === 0) {
                console.log('PoseDetector.detect - video dimensions not ready');
                requestAnimationFrame(() => this.detect());
                return;
            }

            const poseInputScale = this.options.poseInputScale || 1;
            const detectWidth = Math.max(1, Math.floor(fullWidth * poseInputScale));
            const detectHeight = Math.max(1, Math.floor(fullHeight * poseInputScale));
 
 

            // 为每个玩家裁剪区域并发送检测（与 fruit4player.html 一致）
            const promises = [];
            for (let i = 0; i < this.playerConfigs.length; i++) {
                const config = this.playerConfigs[i];
                const canvas = this.canvasCache[i];
                const ctx = canvas.ctx;
                const detectionArea = config.detectionArea;

                if (canvas.width !== detectWidth || canvas.height !== detectHeight) {
                    canvas.width = detectWidth;
                    canvas.height = detectHeight;
                }
                ctx.clearRect(0, 0, detectWidth, detectHeight);

                const regionWidth = (detectionArea.x2 - detectionArea.x1) * fullWidth;
                const regionHeight = (detectionArea.y2 - detectionArea.y1) * fullHeight;
                const srcX = this.options.selfieMode ? ((1 - detectionArea.x2) * fullWidth) : (detectionArea.x1 * fullWidth);
                const srcY = detectionArea.y1 * fullHeight;
                const targetRegionWidth = (detectionArea.x2 - detectionArea.x1) * detectWidth;
                const targetRegionHeight = (detectionArea.y2 - detectionArea.y1) * detectHeight;
                const targetX = this.options.selfieMode ? ((1 - detectionArea.x2) * detectWidth) : (detectionArea.x1 * detectWidth);
                const targetY = detectionArea.y1 * detectHeight;

                ctx.drawImage(this.videoElement, srcX, srcY, regionWidth, regionHeight, targetX, targetY, targetRegionWidth, targetRegionHeight);

                // 发送到 MediaPipe 检测（会触发 onResults 回调）
                promises.push(this.poses[i].send({ image: canvas }));
            }

            await Promise.all(promises);

        } catch (error) {
            console.error('PoseDetector.detect error:', error);
        }

        // 继续下一帧检测
        if (this.isRunning) {
            requestAnimationFrame(() => this.detect());
        }
    }

    /**
     * 检测单个玩家
     * @param {number} playerIndex - 玩家索引
     * @param {number} fullWidth - 视频宽度
     * @param {number} fullHeight - 视频高度
     * @returns {Object} - 检测结果
     */
    async detectSinglePlayer(playerIndex, fullWidth, fullHeight) {
        const config = this.playerConfigs[playerIndex];
        const pose = this.poses[playerIndex];
        const canvas = this.canvasCache[playerIndex];
        
        // 设置 canvas 尺寸
        canvas.width = fullWidth;
        canvas.height = fullHeight;
        
        // 获取上下文（与 fruit4player.html 一致）
        if (!canvas.ctx) {
            canvas.ctx = canvas.getContext('2d');
        }
        const ctx = canvas.ctx;
        
        // 裁剪玩家区域
        const { x1, y1, x2, y2 } = config.detectionArea;
        const regionWidth = (x2 - x1) * fullWidth;
        const regionHeight = (y2 - y1) * fullHeight;
        
        // 计算源坐标和目标坐标（与 fruit4player.html 一致）
        const srcX = this.options.selfieMode ? ((1 - x2) * fullWidth) : (x1 * fullWidth);
        const srcY = y1 * fullHeight;
        
        // 清除画布
        ctx.clearRect(0, 0, fullWidth, fullHeight);
        
        // 将裁剪区域绘制到原始位置（与 fruit4player.html 一致）
        ctx.drawImage(
            this.videoElement,
            srcX, srcY, regionWidth, regionHeight,
            srcX, srcY, regionWidth, regionHeight
        );
        
        // 发送到 MediaPipe 检测
        let results;
        try {
            console.log(`[DEBUG] Player ${playerIndex} - video readyState: ${this.videoElement.readyState}, videoWidth: ${this.videoElement.videoWidth}, videoHeight: ${this.videoElement.videoHeight}`);
            console.log(`[DEBUG] Player ${playerIndex} - canvas size: ${canvas.width}x${canvas.height}, srcX: ${srcX}, srcY: ${srcY}, regionWidth: ${regionWidth}, regionHeight: ${regionHeight}`);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const hasContent = imageData.data.some(pixel => pixel !== 0);
            console.log(`[DEBUG] Player ${playerIndex} - canvas has content: ${hasContent}`);
            
            results = await pose.send({ image: canvas });
            console.log(`[DEBUG] Player ${playerIndex} - pose.send() returned: ${results ? 'OK' : 'undefined/null'}`);
            if (results) {
                console.log(`[DEBUG] Player ${playerIndex} - poseLandmarks: ${results.poseLandmarks ? results.poseLandmarks.length : 'undefined'}`);
            }
        } catch (error) {
            console.error('MediaPipe 检测错误:', error);
            return null;
        }
        
        // 处理 results 为 undefined 的情况
        if (!results) {
            console.warn(`[DEBUG] Player ${playerIndex} - MediaPipe returned undefined`);
            return null;
        }
        
        return {
            playerId: config.id,
            playerIndex: playerIndex,
            landmarks: results.poseLandmarks || [],
            worldLandmarks: results.poseWorldLandmarks || [],
            detectionArea: config.detectionArea
        };
    }

    /**
     * 平滑姿态数据
     * @param {Array} poseHistory - 姿态历史记录
     * @returns {Array} - 平滑后的姿态
     */
    smoothPose(poseHistory) {
        if (!poseHistory || poseHistory.length === 0) return null;
        if (poseHistory.length === 1) return poseHistory[0];

        const smoothedPose = [];
        const landmarkCount = poseHistory[0].length;

        // 计算权重：最近的姿态权重更高
        const weights = [];
        let totalWeight = 0;
        for (let i = 0; i < poseHistory.length; i++) {
            const weight = i + 1;
            weights.push(weight);
            totalWeight += weight;
        }

        for (let i = 0; i < landmarkCount; i++) {
            let weightedSumX = 0;
            let weightedSumY = 0;
            let weightedSumZ = 0;
            let totalWeightForLandmark = 0;

            for (let j = 0; j < poseHistory.length; j++) {
                if (poseHistory[j][i]) {
                    const weight = weights[j];
                    weightedSumX += poseHistory[j][i].x * weight;
                    weightedSumY += poseHistory[j][i].y * weight;
                    weightedSumZ += (poseHistory[j][i].z || 0) * weight;
                    totalWeightForLandmark += weight;
                }
            }

            if (totalWeightForLandmark > 0) {
                smoothedPose[i] = {
                    x: weightedSumX / totalWeightForLandmark,
                    y: weightedSumY / totalWeightForLandmark,
                    z: weightedSumZ / totalWeightForLandmark
                };
            } else {
                smoothedPose[i] = null;
            }
        }

        return smoothedPose;
    }

    /**
     * 获取玩家的最新姿态
     * @param {number} playerId - 玩家ID
     * @returns {Array} - 姿态关键点
     */
    getPlayerPose(playerId) {
        const history = this.poseHistory[playerId];
        return history && history.length > 0 ? history[history.length - 1] : null;
    }

    /**
     * 销毁检测器，释放资源
     */
    destroy() {
        this.stop();
        this.poses.forEach(pose => {
            if (pose.close) {
                pose.close();
            }
        });
        this.poses = [];
        this.canvasCache = [];
        this.videoElement = null;
        this.listeners = {};
        console.log('PoseDetector 已销毁');
        this.emit('destroyed');
    }
}

// ============================================
// 模块2: ActionRecognizer - 动作识别模块
// ============================================

/**
 * 动作识别器类
 * 负责从姿态关键点识别玩家动作
 */
class ActionRecognizer {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {boolean} options.useUpperBodyJumpDetection - 使用上半身判断跳跃
     * @param {number} options.armRaisedThresholdRatio - 抬手阈值比例
     * @param {number} options.jumpUpperThreshold - 上半身跳跃阈值
     * @param {number} options.jumpLowerThreshold - 下半身跳跃阈值
     * @param {number} options.handsOnHeadThreshold - 双手抱头距离阈值
     */
    constructor(options = {}) {
        this.options = {
            useUpperBodyJumpDetection: true,
            armRaisedThresholdRatio: 0.3,
            jumpUpperThreshold: 0.25,
            jumpLowerThreshold: 0.3,
            handsOnHeadThreshold: 0.3,
            actionCooldown: 300, // 动作识别冷却时间(ms)
            ...options
        };
        
        // 动作历史记录，用于稳定性判断
        this.actionHistory = {};
        this.maxActionHistory = 3;
        
        // 最后动作时间，用于冷却
        this.lastActionTime = {};
        
        // 初始化动作历史
        for (let i = 1; i <= 4; i++) {
            this.actionHistory[i] = [];
            this.lastActionTime[i] = 0;
        }

        // 事件监听器
        this.listeners = {};
    }

    /**
     * 添加事件监听器
     * @param {string} eventName - 事件名称
     * @param {Function} callback - 回调函数
     */
    on(eventName, callback) {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(callback);
    }

    /**
     * 触发事件
     * @param {string} eventName - 事件名称
     * @param {*} data - 事件数据
     */
    emit(eventName, data) {
        if (this.listeners[eventName]) {
            this.listeners[eventName].forEach(callback => callback(data));
        }
    }

    /**
     * 检查关键点是否有效
     * @param {Array} landmarks - 关键点数组
     * @param {Array} requiredIndices - 需要的关键点索引
     * @returns {boolean}
     */
    isValid(landmarks, requiredIndices = [0, 11, 12, 15, 16, 23, 24]) {
        if (!landmarks || !Array.isArray(landmarks)) {
            return false;
        }
        return requiredIndices.every(idx => landmarks[idx]);
    }

    /**
     * 计算两点之间的欧几里得距离
     * @param {Object} point1 - 第一个点 {x, y}
     * @param {Object} point2 - 第二个点 {x, y}
     * @returns {number}
     */
    calculateDistance(point1, point2) {
        return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2));
    }

    /**
     * 检测是否举起右手
     * @param {Array} landmarks - 关键点数组
     * @param {number} armRaisedThreshold - 抬手阈值
     * @param {boolean} selfieMode - 是否为自拍模式
     * @returns {boolean}
     */
    detectRightHandRaised(landmarks, armRaisedThreshold, selfieMode) {
        const leftShoulderIdx = selfieMode ? LANDMARK_INDEX.RIGHT_SHOULDER : LANDMARK_INDEX.LEFT_SHOULDER;
        const rightShoulderIdx = selfieMode ? LANDMARK_INDEX.LEFT_SHOULDER : LANDMARK_INDEX.RIGHT_SHOULDER;
        const leftWristIdx = selfieMode ? LANDMARK_INDEX.RIGHT_WRIST : LANDMARK_INDEX.LEFT_WRIST;
        const rightWristIdx = selfieMode ? LANDMARK_INDEX.LEFT_WRIST : LANDMARK_INDEX.RIGHT_WRIST;

        const leftShoulder = landmarks[leftShoulderIdx];
        const rightShoulder = landmarks[rightShoulderIdx];
        const leftWrist = landmarks[leftWristIdx];
        const rightWrist = landmarks[rightWristIdx];

        const leftArmRaised = leftShoulder.y - leftWrist.y > armRaisedThreshold;
        const rightArmRaised = rightShoulder.y - rightWrist.y > armRaisedThreshold;
        return rightArmRaised && !leftArmRaised;
    }

    /**
     * 检测是否举起左手
     * @param {Array} landmarks - 关键点数组
     * @param {number} armRaisedThreshold - 抬手阈值
     * @param {boolean} selfieMode - 是否为自拍模式
     * @returns {boolean}
     */
    detectLeftHandRaised(landmarks, armRaisedThreshold, selfieMode) {
        const leftShoulderIdx = selfieMode ? LANDMARK_INDEX.RIGHT_SHOULDER : LANDMARK_INDEX.LEFT_SHOULDER;
        const rightShoulderIdx = selfieMode ? LANDMARK_INDEX.LEFT_SHOULDER : LANDMARK_INDEX.RIGHT_SHOULDER;
        const leftWristIdx = selfieMode ? LANDMARK_INDEX.RIGHT_WRIST : LANDMARK_INDEX.LEFT_WRIST;
        const rightWristIdx = selfieMode ? LANDMARK_INDEX.LEFT_WRIST : LANDMARK_INDEX.RIGHT_WRIST;

        const leftShoulder = landmarks[leftShoulderIdx];
        const rightShoulder = landmarks[rightShoulderIdx];
        const leftWrist = landmarks[leftWristIdx];
        const rightWrist = landmarks[rightWristIdx];

        const leftArmRaised = leftShoulder.y - leftWrist.y > armRaisedThreshold;
        const rightArmRaised = rightShoulder.y - rightWrist.y > armRaisedThreshold;
        return leftArmRaised && !rightArmRaised;
    }

    /**
     * 检测是否举起双手
     * @param {Array} landmarks - 关键点数组
     * @param {number} armRaisedThreshold - 抬手阈值
     * @param {boolean} selfieMode - 是否为自拍模式
     * @returns {boolean}
     */
    detectBothHandsRaised(landmarks, armRaisedThreshold, selfieMode) {
        const leftShoulderIdx = selfieMode ? LANDMARK_INDEX.RIGHT_SHOULDER : LANDMARK_INDEX.LEFT_SHOULDER;
        const rightShoulderIdx = selfieMode ? LANDMARK_INDEX.LEFT_SHOULDER : LANDMARK_INDEX.RIGHT_SHOULDER;
        const leftWristIdx = selfieMode ? LANDMARK_INDEX.RIGHT_WRIST : LANDMARK_INDEX.LEFT_WRIST;
        const rightWristIdx = selfieMode ? LANDMARK_INDEX.LEFT_WRIST : LANDMARK_INDEX.RIGHT_WRIST;

        const leftShoulder = landmarks[leftShoulderIdx];
        const rightShoulder = landmarks[rightShoulderIdx];
        const leftWrist = landmarks[leftWristIdx];
        const rightWrist = landmarks[rightWristIdx];

        const leftArmRaised = leftShoulder.y - leftWrist.y > armRaisedThreshold;
        const rightArmRaised = rightShoulder.y - rightWrist.y > armRaisedThreshold;
        return leftArmRaised && rightArmRaised;
    }

    /**
     * 检测是否跳跃
     * @param {Array} landmarks - 关键点数组
     * @param {boolean} selfieMode - 是否为自拍模式
     * @returns {boolean}
     */
    detectJumping(landmarks, selfieMode) {
        const nose = landmarks[LANDMARK_INDEX.NOSE];

        const leftShoulderIdx = selfieMode ? LANDMARK_INDEX.RIGHT_SHOULDER : LANDMARK_INDEX.LEFT_SHOULDER;
        const rightShoulderIdx = selfieMode ? LANDMARK_INDEX.LEFT_SHOULDER : LANDMARK_INDEX.RIGHT_SHOULDER;

        const leftShoulder = landmarks[leftShoulderIdx];
        const rightShoulder = landmarks[rightShoulderIdx];
        const leftHip = landmarks[LANDMARK_INDEX.LEFT_HIP];
        const rightHip = landmarks[LANDMARK_INDEX.RIGHT_HIP];

        if (this.options.useUpperBodyJumpDetection) {
            const upperBodyY = (nose.y + leftShoulder.y + rightShoulder.y) / 3;
            return upperBodyY < this.options.jumpUpperThreshold;
        } else {
            const hipY = (leftHip.y + rightHip.y) / 2;
            return hipY < this.options.jumpLowerThreshold;
        }
    }

    /**
     * 检测是否张开双手
     * @param {Array} landmarks - 关键点数组
     * @param {number} shoulderWidth - 肩宽
     * @param {boolean} selfieMode - 是否为自拍模式
     * @returns {boolean}
     */
    detectHandsOpen(landmarks, shoulderWidth, selfieMode) {
        const leftShoulderIdx = selfieMode ? LANDMARK_INDEX.RIGHT_SHOULDER : LANDMARK_INDEX.LEFT_SHOULDER;
        const rightShoulderIdx = selfieMode ? LANDMARK_INDEX.LEFT_SHOULDER : LANDMARK_INDEX.RIGHT_SHOULDER;
        const leftWristIdx = selfieMode ? LANDMARK_INDEX.RIGHT_WRIST : LANDMARK_INDEX.LEFT_WRIST;
        const rightWristIdx = selfieMode ? LANDMARK_INDEX.LEFT_WRIST : LANDMARK_INDEX.RIGHT_WRIST;

        const leftShoulder = landmarks[leftShoulderIdx];
        const rightShoulder = landmarks[rightShoulderIdx];
        const leftWrist = landmarks[leftWristIdx];
        const rightWrist = landmarks[rightWristIdx];

        const isArmsHorizontal = Math.abs(leftWrist.y - leftShoulder.y) < shoulderWidth * 0.9 &&
                                Math.abs(rightWrist.y - rightShoulder.y) < shoulderWidth * 0.9;
        return isArmsHorizontal;
    }

    /**
     * 检测是否双手抱头
     * @param {Array} landmarks - 关键点数组
     * @returns {boolean}
     */
    detectHandsOnHead(landmarks) {
        const leftWrist = landmarks[LANDMARK_INDEX.LEFT_WRIST];
        const rightWrist = landmarks[LANDMARK_INDEX.RIGHT_WRIST];
        const nose = landmarks[LANDMARK_INDEX.NOSE];

        const leftWristToNose = this.calculateDistance(leftWrist, nose);
        const rightWristToNose = this.calculateDistance(rightWrist, nose);
        return leftWristToNose < this.options.handsOnHeadThreshold &&
               rightWristToNose < this.options.handsOnHeadThreshold;
    }

    /**
     * 检测是否伸开右手
     * @param {Array} landmarks - 关键点数组
     * @param {number} shoulderWidth - 肩宽
     * @param {number} armRaisedThreshold - 抬手阈值
     * @param {boolean} selfieMode - 是否为自拍模式
     * @returns {boolean}
     */
    detectRightHandExtended(landmarks, shoulderWidth, armRaisedThreshold, selfieMode) {
        const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
        const rightWrist = landmarks[LANDMARK_INDEX.RIGHT_WRIST];
        const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
        const leftWrist = landmarks[LANDMARK_INDEX.LEFT_WRIST];

        const rightArmRaised = rightShoulder.y - rightWrist.y > armRaisedThreshold;
        const leftArmRaised = leftShoulder.y - leftWrist.y > armRaisedThreshold;

        if (selfieMode === true) {
            return Math.abs(leftWrist.y - leftShoulder.y) < shoulderWidth * 0.4 &&
                   Math.abs(leftWrist.x - leftShoulder.x) > shoulderWidth * 0.5 &&
                   !leftArmRaised && !rightArmRaised;
        } else {
            return Math.abs(rightWrist.y - rightShoulder.y) < shoulderWidth * 0.4 &&
                   Math.abs(rightWrist.x - rightShoulder.x) > shoulderWidth * 0.5 &&
                   !rightArmRaised && !leftArmRaised;
        }
    }

    /**
     * 检测是否伸开左手
     * @param {Array} landmarks - 关键点数组
     * @param {number} shoulderWidth - 肩宽
     * @param {number} armRaisedThreshold - 抬手阈值
     * @param {boolean} selfieMode - 是否为自拍模式
     * @returns {boolean}
     */
    detectLeftHandExtended(landmarks, shoulderWidth, armRaisedThreshold, selfieMode) {
        const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
        const leftWrist = landmarks[LANDMARK_INDEX.LEFT_WRIST];
        const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
        const rightWrist = landmarks[LANDMARK_INDEX.RIGHT_WRIST];

        const leftArmRaised = leftShoulder.y - leftWrist.y > armRaisedThreshold;
        const rightArmRaised = rightShoulder.y - rightWrist.y > armRaisedThreshold;

        if (selfieMode === true) {
            return Math.abs(rightWrist.y - rightShoulder.y) < shoulderWidth * 0.4 &&
                   Math.abs(rightWrist.x - rightShoulder.x) > shoulderWidth * 0.5 &&
                   !rightArmRaised && !leftArmRaised;
        } else {
            return Math.abs(leftWrist.y - leftShoulder.y) < shoulderWidth * 0.4 &&
                   Math.abs(leftWrist.x - leftShoulder.x) > shoulderWidth * 0.5 &&
                   !leftArmRaised && !rightArmRaised;
        }
    }

    /**
     * 识别动作（核心方法）
     * @param {Array} landmarks - 关键点数组
     * @param {boolean} selfieMode - 是否为自拍模式
     * @returns {string} - 识别到的动作
     */
    recognize(landmarks, selfieMode = true, actionTypes = null) {
        // 检查关键点有效性
        if (!this.isValid(landmarks)) {
            return ACTION_TYPE.INCOMPLETE;
        }

        const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
        const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
        const armRaisedThreshold = Math.max(0.1, shoulderWidth * this.options.armRaisedThresholdRatio);

        // 检查动作类型是否在指定列表中
        const shouldCheck = (actionType) => {
            if (!actionTypes || !Array.isArray(actionTypes) || actionTypes.length === 0) {
                return true; // 未指定则检查所有动作
            }
            return actionTypes.includes(actionType);
        };

        // 按优先级顺序检测动作
        // 1. 张开双手 - 双臂水平展开
        if (shouldCheck(ACTION_TYPE.HANDS_OPEN) && this.detectHandsOpen(landmarks, shoulderWidth, selfieMode)) {
            return ACTION_TYPE.HANDS_OPEN;
        }
        // 2. 双手抱头 - 双手靠近头部
        else if (shouldCheck(ACTION_TYPE.HANDS_ON_HEAD) && this.detectHandsOnHead(landmarks)) {
            return ACTION_TYPE.HANDS_ON_HEAD;
        }
        // 3. 举起双手 - 双手同时上举
        else if (shouldCheck(ACTION_TYPE.BOTH_HANDS_RAISED) && this.detectBothHandsRaised(landmarks, armRaisedThreshold, selfieMode)) {
            return ACTION_TYPE.BOTH_HANDS_RAISED;
        }
        // 4. 举起右手 - 仅右手上举
        else if (shouldCheck(ACTION_TYPE.RIGHT_HAND_RAISED) && this.detectRightHandRaised(landmarks, armRaisedThreshold, selfieMode)) {
            return ACTION_TYPE.RIGHT_HAND_RAISED;
        }
        // 5. 举起左手 - 仅左手上举
        else if (shouldCheck(ACTION_TYPE.LEFT_HAND_RAISED) && this.detectLeftHandRaised(landmarks, armRaisedThreshold, selfieMode)) {
            return ACTION_TYPE.LEFT_HAND_RAISED;
        }
        // 6. 伸开右手 - 右手水平伸展
        else if (shouldCheck(ACTION_TYPE.RIGHT_HAND_EXTENDED) && this.detectRightHandExtended(landmarks, shoulderWidth, armRaisedThreshold, selfieMode)) {
            return ACTION_TYPE.RIGHT_HAND_EXTENDED;
        }
        // 7. 伸开左手 - 左手水平伸展
        else if (shouldCheck(ACTION_TYPE.LEFT_HAND_EXTENDED) && this.detectLeftHandExtended(landmarks, shoulderWidth, armRaisedThreshold, selfieMode)) {
            return ACTION_TYPE.LEFT_HAND_EXTENDED;
        }
        // 8. 跳起来 - 身体向上跃起
        else if (shouldCheck(ACTION_TYPE.JUMPING) && this.detectJumping(landmarks, selfieMode)) {
            return ACTION_TYPE.JUMPING;
        }
        // 9. 站立 - 常态站立（默认）
        else {
            // 如果指定了动作类型但都不匹配，返回 INCOMPLETE
            if (actionTypes && Array.isArray(actionTypes) && actionTypes.length > 0) {
                return ACTION_TYPE.INCOMPLETE;
            }
            return ACTION_TYPE.STANDING;
        }
    }

    /**
     * 识别单个玩家的动作（带稳定性检测）
     * @param {number} playerId - 玩家ID
     * @param {Array} landmarks - 关键点数组
     * @param {boolean} selfieMode - 是否为自拍模式
     * @returns {string} - 识别到的动作
     */
    recognizeWithStability(playerId, landmarks, selfieMode = true, actionTypes = null) {
        if (!landmarks || landmarks.length === 0) {
            return ACTION_TYPE.NO_PERSON;
        }

        const action = this.recognize(landmarks, selfieMode, actionTypes);

        // 添加动作到历史记录
        this.actionHistory[playerId].push(action);
        if (this.actionHistory[playerId].length > this.maxActionHistory) {
            this.actionHistory[playerId].shift();
        }

        // 检查动作稳定性：只有当动作在历史记录中占大多数时才更新
        const actionCounts = {};
        for (const histAction of this.actionHistory[playerId]) {
            actionCounts[histAction] = (actionCounts[histAction] || 0) + 1;
        }

        let mostFrequentAction = action;
        let maxCount = 1;
        for (const [act, count] of Object.entries(actionCounts)) {
            if (count > maxCount) {
                maxCount = count;
                mostFrequentAction = act;
            }
        }

        // 只有当动作稳定时才返回（需要至少2次相同动作）
        if (maxCount >= 2) {
            return mostFrequentAction;
        }

        return action;
    }

    /**
     * 识别多人动作（带冷却机制）
     * @param {Array} multiResults - 多人检测结果数组
     * @param {boolean} selfieMode - 是否为自拍模式
     * @returns {Array} - 每个人识别结果的数组
     */
    recognizeMultiPlayer(multiResults, selfieMode = true, actionTypes = null) {
        if (!multiResults || !Array.isArray(multiResults)) {
            return [];
        }

        const now = Date.now();
        const results = [];

        for (const result of multiResults) {
            const playerId = result.playerId;
            let action = this.recognizeWithStability(playerId, result.landmarks, selfieMode, actionTypes);

            // 检查冷却时间
            if (now - this.lastActionTime[playerId] < this.options.actionCooldown) {
                // 冷却中，不更新动作
            } else {
                this.lastActionTime[playerId] = now;
                this.emit('action', { playerId, action, landmarks: result.landmarks });
            }

            results.push({
                playerId: result.playerId,
                playerIndex: result.playerIndex,
                landmarks: result.landmarks,
                action: action
            });
        }

        return results;
    }

    /**
     * 更新配置
     * @param {Object} newOptions - 新配置
     */
    setOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }

    /**
     * 重置动作历史
     * @param {number} playerId - 玩家ID（可选，不传则重置所有）
     */
    resetHistory(playerId = null) {
        if (playerId !== null) {
            this.actionHistory[playerId] = [];
            this.lastActionTime[playerId] = 0;
        } else {
            for (let i = 1; i <= 4; i++) {
                this.actionHistory[i] = [];
                this.lastActionTime[i] = 0;
            }
        }
    }

    /**
     * 销毁识别器
     */
    destroy() {
        this.listeners = {};
        console.log('ActionRecognizer 已销毁');
    }
}

// ============================================
// 模块3: PoseDrawer - 姿态绘制工具类
// ============================================

/**
 * 姿态绘制工具类
 */
class PoseDrawer {
    /**
     * 构造函数
     * @param {HTMLCanvasElement} canvas - 画布元素
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.selfieMode = true;
        this.showLaneLines = true;
        this.showLandmarks = true;
        this.showConnections = true;
        this.showActionLabels = true;
    }

    /**
     * 设置自拍模式
     * @param {boolean} selfieMode - 是否为自拍模式
     */
    setSelfieMode(selfieMode) {
        this.selfieMode = selfieMode;
    }

    /**
     * 设置显示选项
     * @param {Object} options - 显示选项
     */
    setDisplayOptions(options) {
        this.showLaneLines = options.showLaneLines !== undefined ? options.showLaneLines : this.showLaneLines;
        this.showLandmarks = options.showLandmarks !== undefined ? options.showLandmarks : this.showLandmarks;
        this.showConnections = options.showConnections !== undefined ? options.showConnections : this.showConnections;
        this.showActionLabels = options.showActionLabels !== undefined ? options.showActionLabels : this.showActionLabels;
    }

    /**
     * 清除画布
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * 绘制关键点
     * @param {Array} landmarks - 关键点数组
     * @param {Object} options - 绘制选项
     */
    drawLandmarks(landmarks, options = {}) {
        if (!this.showLandmarks || !landmarks || !Array.isArray(landmarks)) return;

        const defaults = {
            radius: 5,
            fillColor: '#FF0000',
            strokeColor: '#FFFFFF',
            strokeWidth: 2
        };
        
        const config = { ...defaults, ...options };

        landmarks.forEach(landmark => {
            if (landmark && landmark.x !== undefined && landmark.y !== undefined) {
                let x = landmark.x * this.canvas.width;
                let y = landmark.y * this.canvas.height;
                
                // 镜像处理
                if (this.selfieMode) {
                    x = this.canvas.width - x;
                }

                this.ctx.beginPath();
                this.ctx.arc(x, y, config.radius, 0, Math.PI * 2);
                this.ctx.fillStyle = config.fillColor;
                this.ctx.fill();
                this.ctx.strokeStyle = config.strokeColor;
                this.ctx.lineWidth = config.strokeWidth;
                this.ctx.stroke();
            }
        });
    }

    /**
     * 绘制骨骼连线
     * @param {Array} landmarks - 关键点数组
     * @param {Object} options - 绘制选项
     */
    drawConnections(landmarks, options = {}) {
        if (!this.showConnections || !landmarks || !Array.isArray(landmarks)) return;

        const defaults = {
            lineWidth: 3,
            strokeColor: '#00FF00'
        };
        
        const config = { ...defaults, ...options };

        // 定义骨骼连接
        const connections = [
            [LANDMARK_INDEX.NOSE, LANDMARK_INDEX.LEFT_EYE_INNER],
            [LANDMARK_INDEX.LEFT_EYE_INNER, LANDMARK_INDEX.LEFT_EYE],
            [LANDMARK_INDEX.LEFT_EYE, LANDMARK_INDEX.LEFT_EYE_OUTER],
            [LANDMARK_INDEX.LEFT_EYE_OUTER, LANDMARK_INDEX.LEFT_EAR],
            [LANDMARK_INDEX.NOSE, LANDMARK_INDEX.RIGHT_EYE_INNER],
            [LANDMARK_INDEX.RIGHT_EYE_INNER, LANDMARK_INDEX.RIGHT_EYE],
            [LANDMARK_INDEX.RIGHT_EYE, LANDMARK_INDEX.RIGHT_EYE_OUTER],
            [LANDMARK_INDEX.RIGHT_EYE_OUTER, LANDMARK_INDEX.RIGHT_EAR],
            [LANDMARK_INDEX.MOUTH_LEFT, LANDMARK_INDEX.MOUTH_RIGHT],
            [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.RIGHT_SHOULDER],
            [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.LEFT_ELBOW],
            [LANDMARK_INDEX.LEFT_ELBOW, LANDMARK_INDEX.LEFT_WRIST],
            [LANDMARK_INDEX.RIGHT_SHOULDER, LANDMARK_INDEX.RIGHT_ELBOW],
            [LANDMARK_INDEX.RIGHT_ELBOW, LANDMARK_INDEX.RIGHT_WRIST],
            [LANDMARK_INDEX.LEFT_WRIST, LANDMARK_INDEX.LEFT_PINKY],
            [LANDMARK_INDEX.LEFT_WRIST, LANDMARK_INDEX.LEFT_INDEX],
            [LANDMARK_INDEX.LEFT_WRIST, LANDMARK_INDEX.LEFT_THUMB],
            [LANDMARK_INDEX.RIGHT_WRIST, LANDMARK_INDEX.RIGHT_PINKY],
            [LANDMARK_INDEX.RIGHT_WRIST, LANDMARK_INDEX.RIGHT_INDEX],
            [LANDMARK_INDEX.RIGHT_WRIST, LANDMARK_INDEX.RIGHT_THUMB],
            [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.LEFT_HIP],
            [LANDMARK_INDEX.RIGHT_SHOULDER, LANDMARK_INDEX.RIGHT_HIP],
            [LANDMARK_INDEX.LEFT_HIP, LANDMARK_INDEX.RIGHT_HIP],
            [LANDMARK_INDEX.LEFT_HIP, LANDMARK_INDEX.LEFT_KNEE],
            [LANDMARK_INDEX.LEFT_KNEE, LANDMARK_INDEX.LEFT_ANKLE],
            [LANDMARK_INDEX.RIGHT_HIP, LANDMARK_INDEX.RIGHT_KNEE],
            [LANDMARK_INDEX.RIGHT_KNEE, LANDMARK_INDEX.RIGHT_ANKLE],
            [LANDMARK_INDEX.LEFT_ANKLE, LANDMARK_INDEX.LEFT_HEEL],
            [LANDMARK_INDEX.LEFT_HEEL, LANDMARK_INDEX.LEFT_FOOT_INDEX],
            [LANDMARK_INDEX.RIGHT_ANKLE, LANDMARK_INDEX.RIGHT_HEEL],
            [LANDMARK_INDEX.RIGHT_HEEL, LANDMARK_INDEX.RIGHT_FOOT_INDEX]
        ];

        this.ctx.strokeStyle = config.strokeColor;
        this.ctx.lineWidth = config.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        connections.forEach(([startIdx, endIdx]) => {
            const start = landmarks[startIdx];
            const end = landmarks[endIdx];
            
            if (start && end && start.x !== undefined && end.x !== undefined) {
                let x1 = start.x * this.canvas.width;
                let y1 = start.y * this.canvas.height;
                let x2 = end.x * this.canvas.width;
                let y2 = end.y * this.canvas.height;
                
                // 镜像处理
                if (this.selfieMode) {
                    x1 = this.canvas.width - x1;
                    x2 = this.canvas.width - x2;
                }

                this.ctx.beginPath();
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke();
            }
        });
    }

    /**
     * 绘制玩家检测区域
     * @param {Object} detectionArea - 检测区域 {x1, y1, x2, y2}
     * @param {string} color - 边框颜色
     */
    drawDetectionArea(detectionArea, color = '#FFFF00') {
        const x1 = detectionArea.x1 * this.canvas.width;
        const y1 = detectionArea.y1 * this.canvas.height;
        const x2 = detectionArea.x2 * this.canvas.width;
        const y2 = detectionArea.y2 * this.canvas.height;
        
        let left = x1;
        let top = y1;
        let width = x2 - x1;
        let height = y2 - y1;
        
        // 镜像处理
        if (this.selfieMode) {
            left = this.canvas.width - x2;
        }

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(left, top, width, height);
        this.ctx.setLineDash([]);
    }

    /**
     * 绘制泳道分割线（矩形检测区域）
     * @param {Array} playerConfigs - 玩家配置数组
     */
    drawLaneLines(playerConfigs) {
        if (!this.showLaneLines || !playerConfigs || playerConfigs.length === 0) {
            console.log('drawLaneLines skipped:', { showLaneLines: this.showLaneLines, hasConfigs: !!playerConfigs && playerConfigs.length > 0 });
            return;
        }

        const colors = ['red', 'blue', 'green', 'yellow'];
        console.log('绘制泳道线，玩家数:', playerConfigs.length);
        
        playerConfigs.forEach((config, index) => {
            const area = config.detectionArea;
            
            // 计算矩形区域坐标（考虑镜像模式）
            const normalizedX1 = this.selfieMode ? (1 - area.x2) : area.x1;
            const normalizedY1 = area.y1;
            const normalizedWidth = area.x2 - area.x1;
            const normalizedHeight = area.y2 - area.y1;
            
            const x1 = this.canvas.width * normalizedX1;
            const y1 = this.canvas.height * normalizedY1;
            const width = this.canvas.width * normalizedWidth;
            const height = this.canvas.height * normalizedHeight;

            // 绘制矩形边框
            this.ctx.beginPath();
            this.ctx.rect(x1, y1, width, height);
            this.ctx.strokeStyle = colors[index % colors.length];
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]); // 虚线
            this.ctx.stroke();
            this.ctx.setLineDash([]); // 恢复实线

            // 绘制玩家编号
            this.ctx.fillStyle = '#FFFF00';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            const centerX = x1 + width / 2;
            this.ctx.fillText(`P${config.id}`, centerX, 20);
            
            console.log(`绘制玩家${config.id}区域: x=${x1.toFixed(0)}, y=${y1.toFixed(0)}, width=${width.toFixed(0)}, height=${height.toFixed(0)}, color=${colors[index % colors.length]}`);
        });
        
        this.ctx.textAlign = 'start'; // 恢复默认对齐
    }

    /**
     * 绘制完整姿态（关键点+骨骼）
     * @param {Array} landmarks - 关键点数组
     * @param {Object} options - 绘制选项
     */
    drawPose(landmarks, options = {}) {
        this.drawConnections(landmarks, options);
        this.drawLandmarks(landmarks, options);
    }

    /**
     * 绘制多个玩家的姿态
     * @param {Array} playerPoses - 玩家姿态数组 [{playerId, landmarks}]
     */
    drawMultiPlayerPoses(playerPoses) {
        const colors = ['red', 'blue', 'green', 'yellow'];
        
        playerPoses.forEach(({ playerId, landmarks }) => {
            if (!landmarks) return;
            
            const color = colors[(playerId - 1) % colors.length];
            
            // 绘制骨骼连接
            this.drawConnections(landmarks, { strokeColor: color });
            
            // 绘制关键点
            this.drawLandmarks(landmarks, { fillColor: color });
            
            // 绘制玩家编号
            if (landmarks[0]) {
                const x = this.selfieMode ? (1 - landmarks[0].x) * this.canvas.width : landmarks[0].x * this.canvas.width;
                const y = landmarks[0].y * this.canvas.height;
                this.ctx.fillStyle = 'white';
                this.ctx.font = 'bold 16px Arial';
                this.ctx.fillText(`P${playerId}`, x, y - 10);
            }
        });
    }

    /**
     * 绘制玩家动作标签
     * @param {Object} actionResult - 动作识别结果
     */
    drawActionLabel(actionResult) {
        if (!this.showActionLabels || !actionResult || !actionResult.landmarks || !actionResult.landmarks[0]) return;

        const x = this.selfieMode ? (1 - actionResult.landmarks[0].x) * this.canvas.width : actionResult.landmarks[0].x * this.canvas.width;
        const y = actionResult.landmarks[0].y * this.canvas.height - 30;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.font = 'bold 14px Arial';
        const textWidth = this.ctx.measureText(actionResult.action).width;
        this.ctx.fillRect(x - textWidth / 2 - 10, y - 20, textWidth + 20, 25);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(actionResult.action, x, y - 5);
    }

    /**
     * 绘制手势轨迹
     * @param {Array} trail - 轨迹点数组
     * @param {string} color - 轨迹颜色
     */
    drawHandTrail(trail, color = '#FF0000') {
        if (!trail || trail.length < 2) return;

        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        const firstPoint = trail[0];
        let x = this.selfieMode ? (1 - firstPoint.x) * this.canvas.width : firstPoint.x * this.canvas.width;
        let y = firstPoint.y * this.canvas.height;
        this.ctx.moveTo(x, y);

        for (let i = 1; i < trail.length; i++) {
            const point = trail[i];
            x = this.selfieMode ? (1 - point.x) * this.canvas.width : point.x * this.canvas.width;
            y = point.y * this.canvas.height;
            this.ctx.lineTo(x, y);
        }

        this.ctx.stroke();
    }

    /**
     * 销毁绘制器
     */
    destroy() {
        this.canvas = null;
        this.ctx = null;
        console.log('PoseDrawer 已销毁');
    }
}

// ============================================
// 模块4: GameFramework - 游戏框架类
// ============================================

/**
 * 游戏框架类
 * 整合姿态检测、动作识别和姿态绘制，提供统一的游戏开发接口
 * 
 * 核心功能：
 * - 多玩家姿态检测（支持1-4人）
 * - 动作识别（举手、跳跃、双手抱头等）
 * - 姿态可视化绘制
 * - 事件驱动架构
 * - 头像捕获功能
 * - 手势轨迹追踪
 */
class GameFramework {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {number} options.playerCount - 玩家数量（1-4）
     * @param {boolean} options.selfieMode - 是否为自拍模式（镜像）
     * @param {string} options.videoElementId - 视频元素ID
     * @param {string} options.poseCanvasId - 姿态画布ID
     * @param {number} options.modelComplexity - 模型复杂度（0,1,2）
     * @param {number} options.minDetectionConfidence - 检测置信度阈值
     * @param {number} options.minTrackingConfidence - 跟踪置信度阈值
     * @param {boolean} options.useUpperBodyJumpDetection - 使用上半身判断跳跃
     * @param {number} options.actionCooldown - 动作识别冷却时间(ms)
     * @param {number} options.detectionAreaTop - 检测区域顶部位置(0-1)
     * @param {number} options.detectionAreaBottom - 检测区域底部位置(0-1)
     * @param {boolean} options.enableSmoothing - 是否启用姿态平滑
     * @param {number} options.smoothHistorySize - 平滑历史记录大小
     */
    constructor(options = {}) {
        this.options = {
            playerCount: 4,
            selfieMode: true,
            videoElementId: 'camera',
            poseCanvasId: 'pose-canvas',
            modelComplexity: 1,
            poseDetectInterval: 50,  //默认 50毫秒，也就是 20fps
            poseInputScale: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
            useUpperBodyJumpDetection: true,
            actionCooldown: 300,
            detectionAreaTop: 0.3,
            detectionAreaBottom: 0.85,
            enableSmoothing: true,
            smoothHistorySize: 3,
            actionTypes: null, // 指定只检测的动作类型，为 null 时检测所有动作
            avatarRadiusRatio: 0.2, // 头像截取半径占视频最小边的比例（0~0.5）
            playerDetectionConfigs: null, // 自定义玩家检测区域配置数组
            ...options
        };

        // 模块实例
        this.poseDetector = null;
        this.actionRecognizer = null;
        this.poseDrawer = null;

        // DOM元素
        this.videoElement = null;
        this.poseCanvas = null;

        // 玩家配置
        this.playerConfigs = [];

        // 游戏状态
        this.isRunning = false;
        this.isInitialized = false;

        // 事件监听器
        this.listeners = {};

        // 最后动作时间（用于防抖）
        this.lastActionTime = {};

        // 手势轨迹追踪
        this.handTrails = {};
        this.maxTrailLength = 20;

        // 玩家开始状态
        this.playerStarted = {};
    }

    /**
     * 添加事件监听器
     * @param {string} eventName - 事件名称
     * @param {Function} callback - 回调函数
     */
    on(eventName, callback) {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(callback);
    }

    /**
     * 触发事件
     * @param {string} eventName - 事件名称
     * @param {*} data - 事件数据
     */
    emit(eventName, data) {
        if (this.listeners[eventName]) {
            this.listeners[eventName].forEach(callback => callback(data));
        }
    }

    /**
     * 初始化框架
     * @param {Array} playerConfigs - 玩家配置数组（可选）
     */
    async init(playerConfigs = null) {
        console.log('GameFramework 初始化中...');

        // 获取DOM元素
        this.videoElement = document.getElementById(this.options.videoElementId);
        this.poseCanvas = document.getElementById(this.options.poseCanvasId);

        console.log('获取DOM元素:', {
            videoElementId: this.options.videoElementId,
            videoElement: !!this.videoElement,
            poseCanvasId: this.options.poseCanvasId,
            poseCanvas: !!this.poseCanvas
        });

        if (!this.videoElement) {
            console.error(`错误: 视频元素 #${this.options.videoElementId} 不存在`);
            throw new Error(`视频元素 #${this.options.videoElementId} 不存在`);
        }

        if (!this.poseCanvas) {
            console.error(`错误: 姿态画布 #${this.options.poseCanvasId} 不存在`);
            throw new Error(`姿态画布 #${this.options.poseCanvasId} 不存在`);
        }

        // 如果没有提供玩家配置，使用默认配置
        if (!playerConfigs) {
            this.playerConfigs = this.generateDefaultPlayerConfigs();
        } else {
            this.playerConfigs = playerConfigs;
        }

        // 创建姿态检测器
        this.poseDetector = new PoseDetector({
            selfieMode: this.options.selfieMode,
            modelComplexity: this.options.modelComplexity,
            poseDetectInterval: this.options.poseDetectInterval,
            poseInputScale: this.options.poseInputScale,
            minDetectionConfidence: this.options.minDetectionConfidence,
            minTrackingConfidence: this.options.minTrackingConfidence
        });

        // 创建动作识别器
        this.actionRecognizer = new ActionRecognizer({
            useUpperBodyJumpDetection: this.options.useUpperBodyJumpDetection,
            actionCooldown: this.options.actionCooldown
        });

        // 创建姿态绘制器
        this.poseDrawer = new PoseDrawer(this.poseCanvas);
        this.poseDrawer.setSelfieMode(this.options.selfieMode);

        // 设置事件监听
        this.setupEventListeners();

        // 初始化姿态检测器
        await this.poseDetector.init(this.playerConfigs, this.videoElement);

        // 初始化玩家动作时间
        this.playerConfigs.forEach(config => {
            this.lastActionTime[config.id] = 0;
        });

        this.isInitialized = true;
        console.log('GameFramework 初始化完成');
        this.emit('initialized', { playerConfigs: this.playerConfigs });
    }

    /**
     * 生成默认玩家配置（使用配置的检测区域参数）
     * @returns {Array} - 玩家配置数组
     */
    generateDefaultPlayerConfigs() {
        // 如果提供了自定义检测区域配置，使用自定义配置
        if (this.options.playerDetectionConfigs && Array.isArray(this.options.playerDetectionConfigs)) {
            console.log('使用自定义玩家检测区域配置:', this.options.playerDetectionConfigs);
            // 确保配置格式正确
            const configs = this.options.playerDetectionConfigs.map((config, index) => ({
                id: config.id || (index + 1),
                detectionArea: config.detectionArea
            }));
            return configs;
        }
        
        // 如果没有提供自定义配置，按照原逻辑根据 playerCount 水平平分画布
        const playerCount = this.options.playerCount;
        const detectionAreaTop = this.options.detectionAreaTop;
        const detectionAreaBottom = this.options.detectionAreaBottom;
        
        // 根据配置动态生成检测区域
        const configs = [];
        for (let i = 0; i < playerCount; i++) {
            const x1 = i * (1 / playerCount);
            const x2 = (i + 1) * (1 / playerCount);
            configs.push({
                id: i + 1,
                detectionArea: {
                    x1: x1,
                    y1: detectionAreaTop,
                    x2: x2,
                    y2: detectionAreaBottom
                }
            });
        }
        
        console.log('生成玩家配置:', {
            playerCount: playerCount,
            detectionAreaTop: detectionAreaTop,
            detectionAreaBottom: detectionAreaBottom,
            configs: configs
        });
        
        return configs;
    }

    /**
     * 设置事件监听
     */
    setupEventListeners() {
        // 姿态检测结果事件
        this.poseDetector.on('results', (results) => {
            console.log('=== 姿态检测结果 ===');
            console.log('检测到', results.length, '个玩家');
            
            // 识别动作（传递 actionTypes 配置）
            const actionResults = this.actionRecognizer.recognizeMultiPlayer(results, this.options.selfieMode, this.options.actionTypes);
            console.log('动作识别结果:', actionResults);
            
            // 输出每个玩家的动作
            actionResults.forEach(result => {
                console.log('玩家', result.playerId, '- 动作:', result.action);
            });
            
            // 更新手势轨迹
            this.updateHandTrails(results);
            
            // 绘制姿态
            this.drawPoses(results, actionResults);
            
            this.emit('poseResults', results);
            this.emit('actionResults', actionResults);
        });

        // 错误事件
        this.poseDetector.on('error', (error) => {
            this.emit('error', error);
        });

        // 动作识别事件（直接转发，ActionRecognizer已经处理了冷却）
        this.actionRecognizer.on('action', (data) => {
            this.emit('playerAction', data);
        });
    }

    /**
     * 更新手势轨迹
     * @param {Array} results - 检测结果数组
     */
    updateHandTrails(results) {
        // 在自拍模式下，由于视频是镜像的，用户看到的"右手"实际上是 LEFT_WRIST
        // 所以需要根据 selfieMode 选择正确的手腕索引
        const wristIndex = this.options.selfieMode ? LANDMARK_INDEX.LEFT_WRIST : LANDMARK_INDEX.RIGHT_WRIST;
        
        results.forEach(result => {
            if (result.landmarks && result.landmarks[wristIndex]) {
                const wrist = result.landmarks[wristIndex];
                this.updateHandTrail(result.playerId, { x: wrist.x, y: wrist.y });
            }
        });
    }

    /**
     * 设置摄像头
     * @returns {Promise}
     */
    async setupCamera() {
        return new Promise((resolve, reject) => {
            console.log('正在设置摄像头...');

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                reject(new Error('浏览器不支持摄像头访问'));
                return;
            }

            navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: false
            })
            .then(stream => {
                this.videoElement.srcObject = stream;
                
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play()
                        .then(() => {
                            console.log('摄像头设置成功');
                            resolve(stream);
                        })
                        .catch(error => {
                            reject(new Error('视频播放失败: ' + error.message));
                        });
                };
            })
            .catch(error => {
                console.error('摄像头访问失败:', error);
                reject(error);
            });
        });
    }

    /**
     * 绘制姿态
     * @param {Array} results - 检测结果数组
     * @param {Array} actionResults - 动作识别结果数组（可选）
     */
    drawPoses(results, actionResults = []) {
        console.log('drawPoses called');
        
        if (!this.poseDrawer || !this.videoElement || !this.poseCanvas) {
            console.log('drawPoses skipped - missing elements:', {
                poseDrawer: !!this.poseDrawer,
                videoElement: !!this.videoElement,
                poseCanvas: !!this.poseCanvas
            });
            return;
        }

        // 检查视频元素状态
        console.log('视频元素状态:', {
            videoWidth: this.videoElement.videoWidth,
            videoHeight: this.videoElement.videoHeight,
            readyState: this.videoElement.readyState,
            paused: this.videoElement.paused
        });

        // 设置画布尺寸
        const videoWidth = this.videoElement.videoWidth || 640;
        const videoHeight = this.videoElement.videoHeight || 480;
        
        console.log('设置画布尺寸:', videoWidth, 'x', videoHeight);
        
        if (this.poseCanvas.width !== videoWidth || this.poseCanvas.height !== videoHeight) {
            this.poseCanvas.width = videoWidth;
            this.poseCanvas.height = videoHeight;
            console.log('Canvas resized to:', videoWidth, 'x', videoHeight);
        }

        // 清除画布
        this.poseDrawer.clear();

        // 绘制视频画面到画布（关键：没有这一步就看不到视频）
        // CSS已经处理了镜像（transform: scaleX(-1)），这里不需要再镜像
        const ctx = this.poseCanvas.getContext('2d');
        ctx.drawImage(this.videoElement, 0, 0, videoWidth, videoHeight);

        // 绘制泳道线
        this.poseDrawer.drawLaneLines(this.playerConfigs);

        // 绘制多个玩家姿态
        const playerPoses = results
            .filter(result => result && result.landmarks && result.landmarks.length > 0)
            .map(result => ({
                playerId: result.playerId,
                landmarks: result.landmarks
            }));
        
        console.log('drawPoses - playerPoses:', playerPoses.length, 'players with landmarks');
        this.poseDrawer.drawMultiPlayerPoses(playerPoses);

        // // 绘制动作标签
        // actionResults.forEach(result => {
        //     this.poseDrawer.drawActionLabel(result);
        // });

        // 不绘制手势轨迹（用户要求两只手都没有彗尾痕迹）
    }

    /**
     * 开始游戏
     */
    start() {
        console.log('GameFramework 开始运行');
        
        // 开始姿态检测
        this.poseDetector.start((results) => {
            // 结果回调已在事件监听中处理
        });

        this.isRunning = true;
        this.emit('started');
    }

    /**
     * 停止游戏
     */
    stop() {
        console.log('GameFramework 停止运行');
        
        this.poseDetector.stop();
        this.isRunning = false;
        this.emit('stopped');
    }

    /**
     * 获取玩家姿态
     * @param {number} playerId - 玩家ID
     * @returns {Array} - 姿态关键点
     */
    getPlayerPose(playerId) {
        return this.poseDetector ? this.poseDetector.getPlayerPose(playerId) : null;
    }

    /**
     * 获取玩家配置
     * @returns {Array} - 玩家配置数组
     */
    getPlayerConfigs() {
        return this.playerConfigs;
    }

    /**
     * 设置显示选项
     * @param {Object} options - 显示选项
     */
    setDisplayOptions(options) {
        if (this.poseDrawer) {
            this.poseDrawer.setDisplayOptions(options);
        }
    }

    /**
     * 捕获玩家头像
     * @param {number} playerId - 玩家ID
     * @param {number} size - 头像大小
     * @returns {string|null} - 头像的data URL
     */
    captureAvatar(playerId, size = 100) {
        const landmarks = this.getPlayerPose(playerId);
        if (!landmarks) return null;
        
        // 使用配置中的头像截取半径比例
        const avatarRadiusRatio = this.options.avatarRadiusRatio || 0.2;
        return captureAvatar(this.videoElement, landmarks, this.options.selfieMode, size, avatarRadiusRatio);
    }

    /**
     * 获取玩家手的位置
     * @param {number} playerId - 玩家ID
     * @param {string} hand - 'left' | 'right'
     * @returns {Object|null} - {x, y} 归一化坐标
     */
    getHandPosition(playerId, hand = 'right') {
        const landmarks = this.getPlayerPose(playerId);
        if (!landmarks) return null;
        
        const wristIndex = hand === 'right' 
            ? LANDMARK_INDEX.RIGHT_WRIST 
            : LANDMARK_INDEX.LEFT_WRIST;
        
        return landmarks[wristIndex] || null;
    }

    /**
     * 更新手势轨迹
     * @param {number} playerId - 玩家ID
     * @param {Object} position - 手的位置 {x, y}
     */
    updateHandTrail(playerId, position) {
        if (!this.handTrails[playerId]) {
            this.handTrails[playerId] = [];
        }
        
        this.handTrails[playerId].push({
            x: position.x,
            y: position.y,
            time: Date.now()
        });
        
        // 限制轨迹长度
        while (this.handTrails[playerId].length > this.maxTrailLength) {
            this.handTrails[playerId].shift();
        }
    }

    /**
     * 获取手势轨迹
     * @param {number} playerId - 玩家ID
     * @returns {Array} - 轨迹点数组
     */
    getHandTrail(playerId) {
        return this.handTrails[playerId] || [];
    }

    /**
     * 清除手势轨迹
     * @param {number} playerId - 玩家ID（可选，不传则清除所有）
     */
    clearHandTrail(playerId = null) {
        if (playerId !== null) {
            this.handTrails[playerId] = [];
        } else {
            this.handTrails = {};
        }
    }

    /**
     * 标记玩家已开始游戏
     * @param {number} playerId - 玩家ID
     */
    markPlayerStarted(playerId) {
        this.playerStarted[playerId] = true;
        this.emit('playerStarted', { playerId });
    }

    /**
     * 检查玩家是否已开始游戏
     * @param {number} playerId - 玩家ID
     * @returns {boolean}
     */
    hasPlayerStarted(playerId) {
        return this.playerStarted[playerId] || false;
    }

    /**
     * 获取所有已开始游戏的玩家ID
     * @returns {Array} - 玩家ID数组
     */
    getStartedPlayers() {
        return Object.keys(this.playerStarted).filter(id => this.playerStarted[id]);
    }

    /**
     * 重置玩家开始状态
     * @param {number} playerId - 玩家ID（可选，不传则重置所有）
     */
    resetPlayerStarted(playerId = null) {
        if (playerId !== null) {
            this.playerStarted[playerId] = false;
        } else {
            this.playerStarted = {};
        }
    }

    /**
     * 设置动作识别配置
     * @param {Object} options - 识别器配置
     */
    setActionOptions(options) {
        if (this.actionRecognizer) {
            this.actionRecognizer.setOptions(options);
        }
    }

    /**
     * 获取当前配置
     * @returns {Object} - 当前配置对象
     */
    getOptions() {
        return { ...this.options };
    }

    /**
     * 检查框架是否正在运行
     * @returns {boolean}
     */
    isFrameworkRunning() {
        return this.isRunning;
    }

    /**
     * 检查框架是否已初始化
     * @returns {boolean}
     */
    isFrameworkInitialized() {
        return this.isInitialized;
    }

    /**
     * 获取玩家配置列表
     * @returns {Array} - 玩家配置数组
     */
    getPlayerConfigs() {
        return [...this.playerConfigs];
    }

    /**
     * 获取指定玩家的配置
     * @param {number} playerId - 玩家ID
     * @returns {Object|null} - 玩家配置
     */
    getPlayerConfig(playerId) {
        return this.playerConfigs.find(config => config.id === playerId) || null;
    }

    /**
     * 销毁框架
     */
    destroy() {
        console.log('GameFramework 销毁中...');
        
        if (this.poseDetector) {
            this.poseDetector.destroy();
        }
        if (this.actionRecognizer) {
            this.actionRecognizer.destroy();
        }
        if (this.poseDrawer) {
            this.poseDrawer.destroy();
        }
        
        // 停止视频流
        if (this.videoElement && this.videoElement.srcObject) {
            this.videoElement.srcObject.getTracks().forEach(track => track.stop());
        }
        
        this.listeners = {};
        this.isRunning = false;
        this.isInitialized = false;
        
        console.log('GameFramework 已销毁');
        this.emit('destroyed');
    }
}

// ============================================
// 工具函数
// ============================================

/**
 * 识别多人场景中每个人的动作
 * @param {Array} multiResults - 多人检测结果数组
 * @param {Object} options - 识别选项
 * @returns {Array} - 每个人识别结果的数组
 */
function recognizeMultiPlayerAction(multiResults, options = {}) {
    if (!multiResults || !Array.isArray(multiResults)) {
        return [];
    }

    const recognizer = new ActionRecognizer(options);
    
    return multiResults.map(result => ({
        playerId: result.playerId,
        playerIndex: result.playerIndex,
        landmarks: result.landmarks,
        action: recognizer.recognize(result.landmarks)
    }));
}

/**
 * 根据鼻子和眼睛截取头像
 * @param {HTMLVideoElement} videoElement - 视频元素
 * @param {Array} landmarks - 姿态关键点
 * @param {boolean} selfieMode - 是否为自拍模式
 * @param {number} size - 头像大小（像素）
 * @returns {string} - 头像的data URL
 */
function captureAvatar(videoElement, landmarks, selfieMode = true, size = 100, avatarRadiusRatio = 0.2) {
    if (!videoElement || !landmarks || landmarks.length === 0) {
        return null;
    }

    // 获取面部关键点
    const nose = landmarks[LANDMARK_INDEX.NOSE];
    const leftEye = landmarks[LANDMARK_INDEX.LEFT_EYE];
    const rightEye = landmarks[LANDMARK_INDEX.RIGHT_EYE];

    if (!nose || !leftEye || !rightEye) {
        return null;
    }

    const videoWidth = videoElement.videoWidth || videoElement.width;
    const videoHeight = videoElement.videoHeight || videoElement.height;

    // 计算面部中心（使用鼻子和双眼的平均坐标）
    let centerX = (nose.x + leftEye.x + rightEye.x) / 3;
    let centerY = (nose.y + leftEye.y + rightEye.y) / 3;

    // 处理自拍模式的镜像
    if (selfieMode) {
        centerX = 1 - centerX;
    }

    // 计算头像截取大小（基于视频最小边的比例）
    const faceSize = Math.min(videoWidth, videoHeight) * avatarRadiusRatio * 2;

    // 计算裁剪区域
    let faceX = centerX * videoWidth - faceSize / 2;
    let faceY = centerY * videoHeight - faceSize / 2;

    // 边界检查
    faceX = Math.max(0, Math.min(faceX, videoWidth - faceSize));
    faceY = Math.max(0, Math.min(faceY, videoHeight - faceSize));

    // 创建头像画布
    const avatarCanvas = document.createElement('canvas');
    avatarCanvas.width = size;
    avatarCanvas.height = size;
    const avatarCtx = avatarCanvas.getContext('2d');

    // 绘制圆形头像
    avatarCtx.beginPath();
    avatarCtx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    avatarCtx.clip();

    avatarCtx.drawImage(videoElement, faceX, faceY, faceSize, faceSize, 0, 0, size, size);

    return avatarCanvas.toDataURL('image/png');
}

/**
 * 计算两点之间的距离
 * @param {Object} p1 - 点1
 * @param {Object} p2 - 点2
 * @returns {number} - 距离
 */
function distance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * 计算关键点的屏幕坐标
 * @param {Object} landmark - 关键点
 * @param {number} canvasWidth - 画布宽度
 * @param {number} canvasHeight - 画布高度
 * @param {boolean} selfieMode - 是否为自拍模式
 * @returns {Object} - 屏幕坐标
 */
function getScreenPosition(landmark, canvasWidth, canvasHeight, selfieMode = true) {
    let x = landmark.x * canvasWidth;
    let y = landmark.y * canvasHeight;

    if (selfieMode) {
        x = canvasWidth - x;
    }

    return { x, y };
}

/**
 * 生成随机颜色
 * @returns {string} - 颜色值
 */
function randomColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * 计算两个向量之间的角度
 * @param {Object} v1 - 向量1 {x, y}
 * @param {Object} v2 - 向量2 {x, y}
 * @returns {number} - 角度（弧度）
 */
function angleBetween(v1, v2) {
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    if (mag1 === 0 || mag2 === 0) return 0;
    return Math.acos(dot / (mag1 * mag2));
}

/**
 * 计算向量的长度
 * @param {Object} v - 向量 {x, y}
 * @returns {number} - 向量长度
 */
function vectorLength(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

/**
 * 计算归一化向量
 * @param {Object} v - 向量 {x, y}
 * @returns {Object} - 归一化向量
 */
function normalizeVector(v) {
    const length = vectorLength(v);
    if (length === 0) return { x: 0, y: 0 };
    return { x: v.x / length, y: v.y / length };
}

/**
 * 计算两个点之间的中点
 * @param {Object} p1 - 点1 {x, y}
 * @param {Object} p2 - 点2 {x, y}
 * @returns {Object} - 中点坐标
 */
function midpoint(p1, p2) {
    return {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
    };
}

/**
 * 检查点是否在矩形区域内
 * @param {Object} point - 点 {x, y}
 * @param {Object} rect - 矩形区域 {x1, y1, x2, y2}
 * @returns {boolean} - 是否在区域内
 */
function isPointInRect(point, rect) {
    return point.x >= rect.x1 && point.x <= rect.x2 &&
           point.y >= rect.y1 && point.y <= rect.y2;
}

/**
 * 线性插值
 * @param {number} start - 起始值
 * @param {number} end - 结束值
 * @param {number} t - 插值因子 (0-1)
 * @returns {number} - 插值结果
 */
function lerp(start, end, t) {
    return start + (end - start) * t;
}

/**
 * 限制值在范围内
 * @param {number} value - 输入值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} - 限制后的值
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * 计算身体角度（基于肩膀和髋部）
 * @param {Array} landmarks - 姿态关键点
 * @returns {number} - 身体角度（弧度）
 */
function calculateBodyAngle(landmarks) {
    const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
    const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
    const leftHip = landmarks[LANDMARK_INDEX.LEFT_HIP];
    const rightHip = landmarks[LANDMARK_INDEX.RIGHT_HIP];
    
    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return 0;
    
    const shoulderMid = midpoint(leftShoulder, rightShoulder);
    const hipMid = midpoint(leftHip, rightHip);
    
    const bodyVector = {
        x: shoulderMid.x - hipMid.x,
        y: shoulderMid.y - hipMid.y
    };
    
    const verticalVector = { x: 0, y: -1 };
    
    return angleBetween(bodyVector, verticalVector);
}

/**
 * 检测身体是否倾斜
 * @param {Array} landmarks - 姿态关键点
 * @param {number} threshold - 倾斜阈值（弧度）
 * @returns {boolean} - 是否倾斜
 */
function isBodyTilted(landmarks, threshold = 0.3) {
    const angle = calculateBodyAngle(landmarks);
    return Math.abs(angle) > threshold;
}

/**
 * 计算手臂角度
 * @param {Array} landmarks - 姿态关键点
 * @param {string} arm - 'left' 或 'right'
 * @returns {number} - 手臂角度（弧度）
 */
function calculateArmAngle(landmarks, arm = 'right') {
    const shoulderIdx = arm === 'right' ? LANDMARK_INDEX.RIGHT_SHOULDER : LANDMARK_INDEX.LEFT_SHOULDER;
    const elbowIdx = arm === 'right' ? LANDMARK_INDEX.RIGHT_ELBOW : LANDMARK_INDEX.LEFT_ELBOW;
    const wristIdx = arm === 'right' ? LANDMARK_INDEX.RIGHT_WRIST : LANDMARK_INDEX.LEFT_WRIST;
    
    const shoulder = landmarks[shoulderIdx];
    const elbow = landmarks[elbowIdx];
    const wrist = landmarks[wristIdx];
    
    if (!shoulder || !elbow || !wrist) return 0;
    
    const upperArm = { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y };
    const lowerArm = { x: wrist.x - elbow.x, y: wrist.y - elbow.y };
    
    return angleBetween(upperArm, lowerArm);
}

/**
 * 检查手臂是否伸直
 * @param {Array} landmarks - 姿态关键点
 * @param {string} arm - 'left' 或 'right'
 * @param {number} threshold - 伸直阈值（弧度）
 * @returns {boolean} - 是否伸直
 */
function isArmExtended(landmarks, arm = 'right', threshold = 0.3) {
    const angle = calculateArmAngle(landmarks, arm);
    return angle < threshold || Math.abs(angle - Math.PI) < threshold;
}

/**
 * 计算手部速度
 * @param {Array} history - 位置历史 [{x, y, time}]
 * @returns {number} - 速度（像素/秒）
 */
function calculateHandSpeed(history) {
    if (history.length < 2) return 0;
    
    const recent = history.slice(-2);
    if (recent.length < 2) return 0;
    
    const p1 = recent[0];
    const p2 = recent[1];
    
    const dist = distance(p1, p2);
    const timeDiff = (p2.time - p1.time) / 1000;
    
    if (timeDiff <= 0) return 0;
    
    return dist / timeDiff;
}

/**
 * 检测手部是否快速移动
 * @param {Array} history - 位置历史 [{x, y, time}]
 * @param {number} threshold - 速度阈值（像素/秒）
 * @returns {boolean} - 是否快速移动
 */
function isHandMovingFast(history, threshold = 500) {
    const speed = calculateHandSpeed(history);
    return speed > threshold;
}

/**
 * 动作防抖工具类
 */
class ActionDebouncer {
    /**
     * 构造函数
     * @param {number} cooldown - 冷却时间(ms)
     */
    constructor(cooldown = 300) {
        this.cooldown = cooldown;
        this.lastActionTime = {};
    }

    /**
     * 检查动作是否可以执行
     * @param {number|string} key - 动作标识符
     * @returns {boolean} - 是否可以执行
     */
    canExecute(key) {
        const now = Date.now();
        const lastTime = this.lastActionTime[key] || 0;
        return now - lastTime >= this.cooldown;
    }

    /**
     * 标记动作已执行
     * @param {number|string} key - 动作标识符
     */
    markExecuted(key) {
        this.lastActionTime[key] = Date.now();
    }

    /**
     * 执行动作（带防抖）
     * @param {number|string} key - 动作标识符
     * @param {Function} action - 要执行的动作
     * @returns {boolean} - 是否成功执行
     */
    execute(key, action) {
        if (this.canExecute(key)) {
            this.markExecuted(key);
            action();
            return true;
        }
        return false;
    }

    /**
     * 设置冷却时间
     * @param {number} cooldown - 冷却时间(ms)
     */
    setCooldown(cooldown) {
        this.cooldown = cooldown;
    }

    /**
     * 重置指定动作的冷却时间
     * @param {number|string} key - 动作标识符
     */
    reset(key) {
        delete this.lastActionTime[key];
    }

    /**
     * 重置所有动作的冷却时间
     */
    resetAll() {
        this.lastActionTime = {};
    }
}

// ============================================
// QuickGameStarter - 快速游戏启动器
// ============================================

class QuickGameStarter {
    /**
     * 构造函数
     * @param {Object} options - 游戏配置
     * @param {Object} options.gameFrameworkOptions - GameFramework 配置
     * @param {Function} options.onInitialized - 初始化完成回调
     * @param {Function} options.onPlayerAction - 玩家动作回调
     * @param {Function} options.onPoseResults - 姿态结果回调
     * @param {Function} options.onActionResults - 动作结果回调
     * @param {Function} options.onError - 错误回调
     * @param {Function} options.onStarted - 框架启动回调
     * @param {Function} options.onCameraReady - 摄像头就绪回调
     */
    constructor(options = {}) {
        this.options = {
            gameFrameworkOptions: {},
            onInitialized: null,
            onPlayerAction: null,
            onPoseResults: null,
            onActionResults: null,
            onError: null,
            onStarted: null,
            onCameraReady: null,
            ...options
        };

        this.gameFramework = null;
        this.isInitialized = false;
    }

    /**
     * 快速启动游戏框架
     * @param {Function} gameLoopCallback - 游戏主循环回调
     * @returns {Promise}
     */
    async start(gameLoopCallback = null) {
        try {
            console.log('QuickGameStarter: 开始启动...');

            // 1. 创建 GameFramework 实例
            this.gameFramework = new GameFramework(this.options.gameFrameworkOptions);
            console.log('QuickGameStarter: GameFramework 实例创建成功');

            // 2. 设置事件监听
            this.setupEventListeners();

            // 3. 初始化框架
            console.log('QuickGameStarter: 开始初始化框架...');
            await this.gameFramework.init();
            console.log('QuickGameStarter: 框架初始化完成');

            // 4. 设置摄像头
            console.log('QuickGameStarter: 开始设置摄像头...');
            await this.gameFramework.setupCamera();
            console.log('QuickGameStarter: 摄像头设置成功');

            // 5. 摄像头就绪回调
            if (this.options.onCameraReady) {
                this.options.onCameraReady(this.gameFramework);
            }

            // 6. 启动游戏主循环
            if (gameLoopCallback) {
                console.log('QuickGameStarter: 启动游戏主循环...');
                gameLoopCallback();
            }

            // 7. 启动姿态检测
            console.log('QuickGameStarter: 启动姿态检测...');
            this.gameFramework.start();
            console.log('QuickGameStarter: === 启动完成 ===');

            this.isInitialized = true;
            return this.gameFramework;

        } catch (error) {
            console.error('QuickGameStarter: 启动失败:', error);
            if (this.options.onError) {
                this.options.onError(error);
            }
            throw error;
        }
    }

    /**
     * 设置事件监听器
     * @private
     */
    setupEventListeners() {
        // 初始化完成
        this.gameFramework.on('initialized', (data) => {
            console.log('QuickGameStarter: 初始化完成:', data);
            
            // 默认：隐藏全局的"等待识别..."提示
            const globalActionDisplay = document.getElementById('action-display');
            if (globalActionDisplay) {
                globalActionDisplay.style.display = 'none';
            }
            
            if (this.options.onInitialized) {
                this.options.onInitialized(data, this.gameFramework);
            }
        });

        // 框架启动
        this.gameFramework.on('started', () => {
            console.log('QuickGameStarter: 框架开始运行');
            if (this.options.onStarted) {
                this.options.onStarted();
            }
        });

        // 玩家动作（高频）
        this.gameFramework.on('playerAction', (result) => {
            console.log('QuickGameStarter: 收到玩家动作:', result.playerId, result.action);
            if (this.options.onPlayerAction) {
                this.options.onPlayerAction(result.playerId, result.action, result.landmarks, this.gameFramework);
            }
        });

        // 姿态结果（高频）
        this.gameFramework.on('poseResults', (results) => {
            console.log('QuickGameStarter: 收到姿态结果:', results.length, '个玩家');
            if (this.options.onPoseResults) {
                this.options.onPoseResults(results, this.gameFramework);
            }
        });

        // 动作识别结果
        this.gameFramework.on('actionResults', (results) => {
            console.log('QuickGameStarter: 收到动作识别结果:', results.length, '个玩家');
            if (this.options.onActionResults) {
                this.options.onActionResults(results, this.gameFramework);
            }
        });

        // 错误处理
        this.gameFramework.on('error', (error) => {
            console.error('QuickGameStarter: GameFramework 错误:', error);
            if (this.options.onError) {
                this.options.onError(error);
            }
        });
    }

    /**
     * 停止游戏框架
     */
    stop() {
        if (this.gameFramework) {
            this.gameFramework.stop();
        }
    }

    /**
     * 获取 GameFramework 实例
     * @returns {GameFramework}
     */
    getFramework() {
        return this.gameFramework;
    }

    /**
     * 快速创建玩家数据结构
     * @param {number} count - 玩家数量
     * @param {Function} playerFactory - 玩家工厂函数
     * @returns {Array}
     */
    createPlayers(count, playerFactory = null) {
        const players = [];
        for (let i = 1; i <= count; i++) {
            if (playerFactory) {
                players.push(playerFactory(i));
            } else {
                players.push({
                    id: i,
                    score: 0,
                    gameRunning: false,
                    currentAction: '',
                    currentPose: null,
                    currentRightHandPosition: null,
                    currentLeftHandPosition: null
                });
            }
        }
        return players;
    }

    /**
     * 快速更新动作显示
     * @param {number} playerId - 玩家ID
     * @param {string} action - 动作名称
     * @param {string} displayIdPrefix - 显示元素ID前缀（默认 'action-display-'）
     */
    updateActionDisplay(playerId, action, displayIdPrefix = 'action-display-') {
        const actionDisplay = document.getElementById(`${displayIdPrefix}${playerId}`);
        if (actionDisplay) {
            actionDisplay.textContent = action;
        }
    }

    /**
     * 快速更新分数显示
     * @param {number} playerId - 玩家ID
     * @param {number} score - 分数
     * @param {string} displayIdPrefix - 显示元素ID前缀（默认 'score-display-'）
     */
    updateScoreDisplay(playerId, score, displayIdPrefix = 'score-display-') {
        const scoreDisplay = document.getElementById(`${displayIdPrefix}${playerId}`);
        if (scoreDisplay) {
            scoreDisplay.textContent = `积分: ${score}`;
        }
    }

    /**
     * 快速截取玩家头像
     * @param {number} playerId - 玩家ID
     * @param {string} avatarIdPrefix - 头像元素ID前缀（默认 'player-avatar-'）
     * @returns {string} - 头像数据URL
     */
    captureAvatar(playerId, avatarIdPrefix = 'player-avatar-') {
        if (!this.gameFramework) return null;
        
        const avatarDataUrl = this.gameFramework.captureAvatar(playerId);
        if (avatarDataUrl) {
            const avatarElement = document.getElementById(`${avatarIdPrefix}${playerId}`);
            if (avatarElement) {
                avatarElement.style.backgroundImage = `url('${avatarDataUrl}')`;
            }
        }
        return avatarDataUrl;
    }
}

// ============================================
// GameRanking - 游戏排名浮窗管理器
// ============================================
class GameRanking {
    constructor() {
        this.rankingContainer = null;
        this.restartTimer = null;
        this.restartTimeLeft = 5;
        this.RESTART_COUNTDOWN = 5;
        this.onRestart = null;
        this.rankingLockedUntil = 0;
    }

    showRankings(players, options = {}) {
        const {
            topCount = 3,
            title = '游戏排名',
            restartCountdown = 5,
            onRestart = null,
            minDisplayTime = 0,
            returnUrl = '/smartgames.html'
        } = options;

        this.RESTART_COUNTDOWN = restartCountdown;
        this.onRestart = onRestart;
        this.rankingLockedUntil = Date.now() + minDisplayTime;

        const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
        const topPlayers = sortedPlayers.slice(0, topCount);

        this.rankingContainer = document.createElement('div');
        this.rankingContainer.id = 'game-rankings';
        this.rankingContainer.dataset.lockedUntil = String(this.rankingLockedUntil);

        const podiumContent = topPlayers.map((player, index) => {
            let avatarStyle = '';
            if (player.avatar) {
                avatarStyle = `background-image: url('${player.avatar}');`;
            } else {
                avatarStyle = 'background-color: #f0f0f0; background-image: none; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #666;';
            }

            return `
                <div class="podium-step rank-${index + 1}">
                    <div class="rank-number">${index + 1}</div>
                    <div class="player-avatar" style="${avatarStyle}">${player.avatar ? '' : player.id}</div>
                    <div class="player-name">玩家${player.id}</div>
                    <div class="player-score">${player.score}分</div>
                </div>
            `;
        }).join('');

        this.rankingContainer.innerHTML = `
            <div class="ranking-header">
                <h2>${title}</h2>
                <button id="close-ranking">×</button>
            </div>
            <div class="ranking-content">
                <div class="podium">
                    ${podiumContent}
                </div>
            </div>
            <div class="ranking-footer">
                <span class="restart-hint" style="font-size:26px;">举右手重新开始；</span>
                <span class="restart-countdown" id="restart-countdown">${this.RESTART_COUNTDOWN}</span>
                <span class="restart-hint" style="font-size:26px;">秒后回游戏列表</span>
            </div>
        `;

        document.body.appendChild(this.rankingContainer);
        this.startRestartCountdown(returnUrl);

        document.getElementById('close-ranking').addEventListener('click', () => {
            if (this.isInteractionLocked()) {
                return;
            }

            this.hide();
            if (this.onRestart) {
                this.onRestart();
            }
        });
    }

    isInteractionLocked() {
        return Date.now() < this.rankingLockedUntil;
    }

    hide() {
        if (this.rankingContainer) {
            document.body.removeChild(this.rankingContainer);
            this.rankingContainer = null;
        }
        this.stopRestartCountdown();
    }

    startRestartCountdown(returnUrl = '/smartgames.html') {
        const countdownElement = document.getElementById('restart-countdown');
        if (!countdownElement) return;

        this.restartTimeLeft = this.RESTART_COUNTDOWN;
        countdownElement.textContent = this.restartTimeLeft;

        this.restartTimer = setInterval(() => {
            this.restartTimeLeft--;
            countdownElement.textContent = this.restartTimeLeft;

            if (this.restartTimeLeft <= 0 && !this.isInteractionLocked()) {
                this.stopRestartCountdown();
                window.location.href = returnUrl;
            }
        }, 1000);
    }

    stopRestartCountdown() {
        if (this.restartTimer) {
            clearInterval(this.restartTimer);
            this.restartTimer = null;
        }
    }
}

// 导出模块（支持浏览器环境）
if (typeof window !== 'undefined') {
    window.LANDMARK_INDEX = LANDMARK_INDEX;
    window.ACTION_TYPE = ACTION_TYPE;
    window.PoseDetector = PoseDetector;
    window.ActionRecognizer = ActionRecognizer;
    window.PoseDrawer = PoseDrawer;
    window.GameFramework = GameFramework;
    window.QuickGameStarter = QuickGameStarter;
    window.ActionDebouncer = ActionDebouncer;
    window.GameRanking = GameRanking;
    window.recognizeMultiPlayerAction = recognizeMultiPlayerAction;
    window.captureAvatar = captureAvatar;
    window.distance = distance;
    window.getScreenPosition = getScreenPosition;
    window.randomColor = randomColor;
    window.angleBetween = angleBetween;
    window.vectorLength = vectorLength;
    window.normalizeVector = normalizeVector;
    window.midpoint = midpoint;
    window.isPointInRect = isPointInRect;
    window.lerp = lerp;
    window.clamp = clamp;
    window.calculateBodyAngle = calculateBodyAngle;
    window.isBodyTilted = isBodyTilted;
    window.calculateArmAngle = calculateArmAngle;
    window.isArmExtended = isArmExtended;
    window.calculateHandSpeed = calculateHandSpeed;
    window.isHandMovingFast = isHandMovingFast;
}

// CommonJS 导出（支持Node.js环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        LANDMARK_INDEX,
        ACTION_TYPE,
        PoseDetector,
        ActionRecognizer,
        PoseDrawer,
        GameFramework,
        QuickGameStarter,
        ActionDebouncer,
        recognizeMultiPlayerAction,
        captureAvatar,
        distance,
        getScreenPosition,
        randomColor,
        angleBetween,
        vectorLength,
        normalizeVector,
        midpoint,
        isPointInRect,
        lerp,
        clamp,
        calculateBodyAngle,
        isBodyTilted,
        calculateArmAngle,
        isArmExtended,
        calculateHandSpeed,
        isHandMovingFast
    };
}
