import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';

class FrogGame {
    constructor() {
        console.log('FrogGame构造函数开始执行');
        
        // 检查DOM元素是否存在
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('找不到gameCanvas元素');
            return;
        }
        console.log('找到gameCanvas元素');
        
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('无法获取canvas 2D上下文');
            return;
        }
        console.log('获取canvas 2D上下文成功');
        
        this.cameraFeed = document.getElementById('cameraFeed');
        if (!this.cameraFeed) {
            console.error('找不到cameraFeed元素');
        }
        
        this.cameraCanvas = document.getElementById('cameraCanvas');
        if (!this.cameraCanvas) {
            console.error('找不到cameraCanvas元素');
        } else {
            this.cameraCtx = this.cameraCanvas.getContext('2d');
            if (!this.cameraCtx) {
                console.error('无法获取cameraCanvas 2D上下文');
            }
        }
        
        this.scoreElement = document.getElementById('score');
        this.timerElement = document.getElementById('timer');
        this.statusElement = document.getElementById('status');
        this.gestureStatusElement = document.getElementById('gestureStatus');
        this.resultElement = document.getElementById('result');
        this.finalScoreElement = document.getElementById('finalScore');
        this.accuracyElement = document.getElementById('accuracy');
        
        this.startBtn = document.getElementById('startBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.playAgainBtn = document.getElementById('playAgainBtn');
        this.startCameraBtn = document.getElementById('startCameraBtn');
        
        console.log('DOM元素获取完成');
        console.log('canvas尺寸:', this.canvas.width, 'x', this.canvas.height);
        
        this.score = 0;
        this.timeLeft = 60;
        this.gameStarted = false;
        this.gameInterval = null;
        this.timerInterval = null;
        this.cameraStarted = false;
        this.poseDetectionInterval = null;
        
        this.frog = {
            x: 100,
            y: 300,
            width: 50,
            height: 50,
            jumping: false,
            jumpHeight: 100,
            jumpSpeed: 5
        };
        
        this.lilypads = [];
        this.obstacles = [];
        this.jumpCount = 0;
        this.correctJumps = 0;
        
        this.isModelLoaded = false;
        this.detector = null;
        this.lastJumpTime = 0;
        this.jumpCooldown = 500; // 跳跃冷却时间（毫秒）
        
        this.init();
        this.setupEventListeners();
        this.setupKeyboardControls();
        this.loadModels();
        
        console.log('FrogGame构造函数执行完成');
    }
    
    init() {
        console.log('init方法开始执行');
        
        this.score = 0;
        this.timeLeft = 60;
        this.jumpCount = 0;
        this.correctJumps = 0;
        this.frog.x = 100;
        this.frog.y = 300;
        this.frog.jumping = false;
        this.lilypads = [];
        this.obstacles = [];
        
        console.log('初始化游戏状态完成');
        
        if (this.scoreElement) {
            this.scoreElement.textContent = this.score;
        }
        if (this.timerElement) {
            this.timerElement.textContent = this.timeLeft;
        }
        if (this.statusElement) {
            this.statusElement.textContent = '准备开始';
        }
        if (this.resultElement) {
            this.resultElement.style.display = 'none';
        }
        
        console.log('更新UI元素完成');
        
        this.generateLilypads();
        console.log('生成荷叶完成，数量:', this.lilypads.length);
        
        this.generateObstacles();
        console.log('生成障碍物完成，数量:', this.obstacles.length);
        
        this.draw();
        console.log('绘制游戏画面完成');
    }
    
    setupEventListeners() {
        console.log('setupEventListeners方法开始执行');
        
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.startGame());
        }
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => this.init());
        }
        if (this.playAgainBtn) {
            this.playAgainBtn.addEventListener('click', () => this.init());
        }
        if (this.startCameraBtn) {
            this.startCameraBtn.addEventListener('click', () => this.setupCamera());
        }
        
        console.log('setupEventListeners方法执行完成');
    }
    
    setupKeyboardControls() {
        console.log('setupKeyboardControls方法开始执行');
        
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.frog.jumping && this.gameStarted) {
                this.jumpCount++;
                this.frog.jumping = true;
                this.performJump();
            }
        });
        
        console.log('setupKeyboardControls方法执行完成');
    }
    
    async loadModels() {
        console.log('loadModels方法开始执行');
        
        try {
            console.log('检查TensorFlow.js是否加载:', typeof tf !== 'undefined');
            console.log('检查poseDetection是否加载:', typeof poseDetection !== 'undefined');
            
            if (!tf) {
                console.error('TensorFlow.js未加载');
                this.isModelLoaded = false;
                if (this.statusElement) {
                    this.statusElement.textContent = 'TensorFlow.js未加载，使用键盘控制';
                }
                return;
            }
            
            if (!poseDetection) {
                console.error('Pose Detection模型未加载');
                this.isModelLoaded = false;
                if (this.statusElement) {
                    this.statusElement.textContent = 'Pose Detection模型未加载，使用键盘控制';
                }
                return;
            }
            
            console.log('正在加载Pose Detection模型...');
            if (this.statusElement) {
                this.statusElement.textContent = '正在加载模型...';
            }
            
            await tf.setBackend('cpu');
            await tf.ready();
            
            console.log('MoveNet模型类型:', poseDetection.movenet.modelType);
            
            const detectorConfig = {
                modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
                enableSmoothing: true,
                inputResolution: { width: 640, height: 480 }
            };
            
            console.log('创建检测器，配置:', detectorConfig);
            
            this.detector = await poseDetection.createDetector(
                poseDetection.SupportedModels.MoveNet,
                detectorConfig
            );
            
            this.isModelLoaded = true;
            console.log('模型加载成功，检测器创建完成');
            if (this.statusElement) {
                this.statusElement.textContent = '模型加载成功，准备开始';
            }
        } catch (error) {
            console.error('模型加载失败:', error);
            console.error('错误详情:', error.message);
            this.isModelLoaded = false;
            if (this.statusElement) {
                this.statusElement.textContent = '模型加载失败，使用键盘控制';
            }
        }
        
        console.log('loadModels方法执行完成，isModelLoaded:', this.isModelLoaded);
    }
    
    async setupCamera() {
        console.log('setupCamera方法开始执行');
        
        if (this.cameraStarted) {
            console.log('摄像头已经启动');
            return;
        }
        
        console.log('正在请求摄像头权限...');
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('浏览器不支持摄像头访问');
            if (this.statusElement) {
                this.statusElement.textContent = '浏览器不支持摄像头，使用键盘控制';
            }
            this.isModelLoaded = false;
            return;
        }
        
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            console.error('摄像头访问需要HTTPS环境');
            if (this.statusElement) {
                this.statusElement.textContent = '摄像头需要HTTPS环境，使用键盘控制';
            }
            this.isModelLoaded = false;
            return;
        }
        
        try {
            const constraints = {
                video: {
                    facingMode: { ideal: 'user' },
                    width: { ideal: 640, min: 320 },
                    height: { ideal: 480, min: 240 },
                    frameRate: { ideal: 30, min: 15 }
                },
                audio: false
            };
            
            console.log('请求摄像头，约束条件:', constraints);
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('摄像头权限获取成功');
            
            if (this.cameraFeed) {
                this.cameraFeed.srcObject = stream;
                this.cameraStarted = true;
                
                return new Promise((resolve, reject) => {
                    if (this.cameraFeed) {
                        this.cameraFeed.onloadedmetadata = () => {
                            console.log('摄像头元数据加载完成');
                            console.log('视频尺寸:', this.cameraFeed.videoWidth, 'x', this.cameraFeed.videoHeight);
                            this.cameraFeed.play()
                                .then(() => {
                                    console.log('摄像头播放成功');
                                    if (this.statusElement) {
                                        this.statusElement.textContent = '摄像头已连接，准备开始';
                                    }
                                    if (this.startCameraBtn) {
                                        this.startCameraBtn.textContent = '摄像头已启动';
                                        this.startCameraBtn.disabled = true;
                                    }
                                    
                                    // 开始姿势检测
                                    if (this.isModelLoaded) {
                                        this.startPoseDetection();
                                    }
                                    
                                    resolve();
                                })
                                .catch((playError) => {
                                    console.error('摄像头播放失败:', playError);
                                    if (this.statusElement) {
                                        this.statusElement.textContent = '摄像头播放失败，使用键盘控制';
                                    }
                                    this.isModelLoaded = false;
                                    stream.getTracks().forEach(track => track.stop());
                                    this.cameraStarted = false;
                                    reject(playError);
                                });
                        };
                        
                        this.cameraFeed.onerror = (error) => {
                            console.error('摄像头错误:', error);
                            if (this.statusElement) {
                                this.statusElement.textContent = '摄像头错误，使用键盘控制';
                            }
                            this.isModelLoaded = false;
                            stream.getTracks().forEach(track => track.stop());
                            this.cameraStarted = false;
                            reject(error);
                        };
                    }
                });
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            console.error('错误详情:', error.name, error.message);
            
            if (this.statusElement) {
                if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                    this.statusElement.textContent = '摄像头权限被拒绝，请允许摄像头权限后重试';
                } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                    this.statusElement.textContent = '未找到摄像头设备，使用键盘控制';
                } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                    this.statusElement.textContent = '摄像头被占用，请关闭其他应用后重试';
                } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
                    console.error('摄像头约束条件不满足');
                    this.statusElement.textContent = '摄像头配置不支持，使用键盘控制';
                } else if (error.name === 'TypeError' && error.message.includes('getUserMedia')) {
                    console.error('getUserMedia不可用');
                    this.statusElement.textContent = '浏览器不支持摄像头，使用键盘控制';
                } else {
                    this.statusElement.textContent = '摄像头访问失败，使用键盘控制';
                }
            }
            
            this.isModelLoaded = false;
            this.cameraStarted = false;
        }
        
        console.log('setupCamera方法执行完成');
    }
    
    startPoseDetection() {
        console.log('startPoseDetection方法开始执行');
        
        if (this.poseDetectionInterval) {
            clearInterval(this.poseDetectionInterval);
        }
        
        this.poseDetectionInterval = setInterval(() => {
            this.detectPose();
        }, 50); // 每50毫秒检测一次姿势，提高检测频率
        
        console.log('姿势检测已开始');
    }
    
    async detectPose() {
        if (!this.isModelLoaded || !this.cameraStarted) {
            this.updateGestureStatus('无法判断动作');
            return;
        }
        
        try {
            if (!this.cameraFeed || this.cameraFeed.paused) {
                this.updateGestureStatus('无法判断动作');
                return;
            }
            
            // 绘制摄像头画面到canvas
            if (this.cameraCanvas && this.cameraCtx) {
                this.cameraCtx.drawImage(this.cameraFeed, 0, 0, this.cameraCanvas.width, this.cameraCanvas.height);
            }
            
            // 检测姿势
            const poses = await this.detector.estimatePoses(this.cameraFeed);
            
            if (poses.length > 0) {
                const pose = poses[0];
                
                // 只处理得分较高的姿势
                if (pose.score > 0.3) {
                    this.processPose(pose);
                    
                    // 在摄像头画面上绘制关键点
                    if (this.cameraCanvas && this.cameraCtx) {
                        this.drawPoseKeypoints(pose);
                    }
                } else {
                    this.updateGestureStatus('无法判断动作');
                }
            } else {
                this.updateGestureStatus('无法判断动作');
            }
        } catch (error) {
            console.error('姿势检测出错:', error);
            this.updateGestureStatus('无法判断动作');
        }
    }
    
    processPose(pose) {
        // 检查是否检测到足够的关键点
        if (!pose.keypoints || pose.keypoints.length < 17) {
            this.updateGestureStatus('无法判断动作');
            return;
        }
        
        // 获取关键关节点
        const nose = pose.keypoints.find(kp => kp.name === 'nose');
        const leftWrist = pose.keypoints.find(kp => kp.name === 'left_wrist');
        const rightWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');
        const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
        const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
        
        // 检查关键点是否存在且置信度足够
        if (!nose || !leftWrist || !rightWrist || !leftShoulder || !rightShoulder) {
            this.updateGestureStatus('无法判断动作');
            return;
        }
        
        // 使用更低的置信度阈值，提高检测灵敏度
        if (nose.score < 0.2 || leftWrist.score < 0.2 || rightWrist.score < 0.2 || 
            leftShoulder.score < 0.2 || rightShoulder.score < 0.2) {
            this.updateGestureStatus('无法判断动作');
            return;
        }
        
        // 计算位置
        const noseY = nose.y;
        const leftWristY = leftWrist.y;
        const rightWristY = rightWrist.y;
        const leftShoulderY = leftShoulder.y;
        const rightShoulderY = rightShoulder.y;
        
        // 计算肩膀宽度，用于标准化判断
        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
        const armRaisedThreshold = shoulderWidth * 0.3; // 使用肩膀宽度的百分比作为阈值
        
        // 手臂抬起判断：手腕在肩膀上方
        const leftArmRaised = leftWristY < leftShoulderY - armRaisedThreshold;
        const rightArmRaised = rightWristY < rightShoulderY - armRaisedThreshold;
        
        // 双手举过头顶判断：手腕在鼻子上方
        const leftWristAboveHead = leftWristY < noseY - 10;
        const rightWristAboveHead = rightWristY < noseY - 10;
        
        // 判断手势类型
        let gestureType = '无法判断动作';
        
        if (leftArmRaised && rightArmRaised) {
            gestureType = '双手举起';
        } else if (leftArmRaised) {
            gestureType = '单手举起（左手）';
        } else if (rightArmRaised) {
            gestureType = '单手举起（右手）';
        }
        
        // 更新手势状态显示
        this.updateGestureStatus(gestureType);
        
        // 检测跳跃手势（双手举起或双手举过头顶）
        const jumpGesture = (leftArmRaised && rightArmRaised) || (leftWristAboveHead && rightWristAboveHead);
        
        if (jumpGesture) {
            const currentTime = Date.now();
            
            // 检查是否在冷却时间内
            if (currentTime - this.lastJumpTime > this.jumpCooldown) {
                // 触发跳跃
                if (!this.frog.jumping && this.gameStarted) {
                    this.jumpCount++;
                    this.frog.jumping = true;
                    this.performJump();
                    this.lastJumpTime = currentTime;
                }
            }
        }
    }
    
    updateGestureStatus(gestureType) {
        if (this.gestureStatusElement) {
            this.gestureStatusElement.textContent = gestureType;
            
            // 根据手势类型设置不同的颜色
            if (gestureType === '无法判断动作') {
                this.gestureStatusElement.className = 'gesture-status';
            } else {
                this.gestureStatusElement.className = 'gesture-status active';
            }
            
            console.log('手势状态更新为:', gestureType);
        }
    }
    
    drawPoseKeypoints(pose) {
        if (!pose.keypoints) return;
        
        // 清除画布
        this.cameraCtx.clearRect(0, 0, this.cameraCanvas.width, this.cameraCanvas.height);
        
        // 绘制骨架
        const connections = [
            ['nose', 'left_eye'], ['left_eye', 'left_ear'],
            ['nose', 'right_eye'], ['right_eye', 'right_ear'],
            ['nose', 'left_shoulder'], ['nose', 'right_shoulder'],
            ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
            ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
            ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
            ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
            ['right_hip', 'right_knee'], ['right_knee', 'right_ankle']
        ];
        
        // 绘制骨骼连接线
        this.cameraCtx.strokeStyle = '#4CAF50';
        this.cameraCtx.lineWidth = 3;
        
        connections.forEach(([start, end]) => {
            const startKeypoint = pose.keypoints.find(kp => kp.name === start);
            const endKeypoint = pose.keypoints.find(kp => kp.name === end);
            
            if (startKeypoint && endKeypoint && startKeypoint.score > 0.2 && endKeypoint.score > 0.2) {
                this.cameraCtx.beginPath();
                this.cameraCtx.moveTo(startKeypoint.x, startKeypoint.y);
                this.cameraCtx.lineTo(endKeypoint.x, endKeypoint.y);
                this.cameraCtx.stroke();
            }
        });
        
        // 绘制关键点
        pose.keypoints.forEach(keypoint => {
            if (keypoint.score > 0.2) {
                // 根据置信度设置颜色
                const confidence = keypoint.score;
                const alpha = Math.min(1, confidence);
                
                this.cameraCtx.beginPath();
                this.cameraCtx.arc(keypoint.x, keypoint.y, 6, 0, 2 * Math.PI);
                
                // 关键关节点用不同颜色
                if (['nose', 'left_shoulder', 'right_shoulder', 'left_wrist', 'right_wrist'].includes(keypoint.name)) {
                    this.cameraCtx.fillStyle = `rgba(255, 99, 132, ${alpha})`;
                    this.cameraCtx.strokeStyle = `rgba(255, 99, 132, ${alpha})`;
                } else {
                    this.cameraCtx.fillStyle = `rgba(76, 175, 80, ${alpha})`;
                    this.cameraCtx.strokeStyle = `rgba(76, 175, 80, ${alpha})`;
                }
                
                this.cameraCtx.fill();
                this.cameraCtx.lineWidth = 2;
                this.cameraCtx.stroke();
            }
        });
    }
    
    generateLilypads() {
        console.log('generateLilypads方法开始执行');
        
        for (let i = 0; i < 5; i++) {
            this.lilypads.push({
                x: 200 + i * 150,
                y: 300 + Math.random() * 50 - 25,
                width: 80,
                height: 20
            });
        }
        
        console.log('generateLilypads方法执行完成');
    }
    
    generateObstacles() {
        console.log('generateObstacles方法开始执行');
        
        for (let i = 0; i < 3; i++) {
            this.obstacles.push({
                x: 250 + i * 200,
                y: 320,
                width: 40,
                height: 40,
                speed: 2 + Math.random() * 3
            });
        }
        
        console.log('generateObstacles方法执行完成');
    }
    
    startGame() {
        console.log('startGame方法开始执行');
        
        if (this.gameStarted) {
            console.log('游戏已经开始');
            return;
        }
        
        this.gameStarted = true;
        if (this.statusElement) {
            this.statusElement.textContent = '游戏进行中';
        }
        if (this.startBtn) {
            this.startBtn.disabled = true;
        }
        
        console.log('游戏开始');
        
        this.gameInterval = setInterval(() => this.update(), 20);
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);
        
        console.log('startGame方法执行完成');
    }
    
    updateTimer() {
        console.log('updateTimer方法开始执行');
        
        this.timeLeft--;
        if (this.timerElement) {
            this.timerElement.textContent = this.timeLeft;
        }
        
        console.log('时间剩余:', this.timeLeft);
        
        if (this.timeLeft <= 0) {
            console.log('时间到，游戏结束');
            this.endGame();
        }
        
        console.log('updateTimer方法执行完成');
    }
    
    update() {
        console.log('update方法开始执行');
        
        this.moveObstacles();
        this.checkCollisions();
        this.draw();
        
        console.log('update方法执行完成');
    }
    
    moveObstacles() {
        console.log('moveObstacles方法开始执行');
        
        this.obstacles.forEach(obstacle => {
            obstacle.x -= obstacle.speed;
            if (obstacle.x < -obstacle.width) {
                obstacle.x = this.canvas.width + Math.random() * 200;
                obstacle.speed = 2 + Math.random() * 3;
            }
        });
        
        console.log('moveObstacles方法执行完成');
    }
    
    checkCollisions() {
        console.log('checkCollisions方法开始执行');
        
        this.obstacles.forEach(obstacle => {
            if (this.checkCollision(this.frog, obstacle)) {
                this.score -= 10;
                if (this.score < 0) this.score = 0;
                if (this.scoreElement) {
                    this.scoreElement.textContent = this.score;
                }
            }
        });
        
        this.lilypads.forEach(lilypad => {
            if (this.checkCollision(this.frog, lilypad)) {
                this.score += 5;
                if (this.scoreElement) {
                    this.scoreElement.textContent = this.score;
                }
            }
        });
        
        console.log('checkCollisions方法执行完成');
    }
    
    checkCollision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }
    
    performJump() {
        console.log('performJump方法开始执行');
        
        let jumpProgress = 0;
        const jumpInterval = setInterval(() => {
            jumpProgress += this.frog.jumpSpeed;
            
            if (jumpProgress < this.frog.jumpHeight / 2) {
                this.frog.y -= this.frog.jumpSpeed;
            } else {
                this.frog.y += this.frog.jumpSpeed;
            }
            
            if (jumpProgress >= this.frog.jumpHeight) {
                clearInterval(jumpInterval);
                this.frog.jumping = false;
                this.correctJumps++;
            }
        }, 20);
        
        this.frog.x += 100;
        if (this.frog.x > this.canvas.width) {
            this.frog.x = 100;
        }
        
        console.log('performJump方法执行完成');
    }
    
    draw() {
        console.log('draw方法开始执行');
        
        if (!this.ctx) {
            console.error('ctx不存在，无法绘制');
            return;
        }
        
        try {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            console.log('清除画布完成');
            
            this.drawBackground();
            console.log('绘制背景完成');
            
            this.drawLilypads();
            console.log('绘制荷叶完成');
            
            this.drawObstacles();
            console.log('绘制障碍物完成');
            
            this.drawFrog();
            console.log('绘制青蛙完成');
        } catch (error) {
            console.error('绘制过程中出错:', error);
        }
        
        console.log('draw方法执行完成');
    }
    
    drawBackground() {
        this.ctx.fillStyle = '#e8f4f8';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#3498db';
        this.ctx.fillRect(0, 350, this.canvas.width, 50);
    }
    
    drawLilypads() {
        this.lilypads.forEach(lilypad => {
            this.ctx.fillStyle = '#27ae60';
            this.ctx.beginPath();
            this.ctx.ellipse(lilypad.x, lilypad.y, lilypad.width / 2, lilypad.height / 2, 0, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    drawObstacles() {
        this.obstacles.forEach(obstacle => {
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.beginPath();
            this.ctx.arc(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2, obstacle.width / 2, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    drawFrog() {
        this.ctx.fillStyle = '#27ae60';
        this.ctx.beginPath();
        this.ctx.arc(this.frog.x + this.frog.width / 2, this.frog.y + this.frog.height / 2, this.frog.width / 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = 'black';
        this.ctx.beginPath();
        this.ctx.arc(this.frog.x + 15, this.frog.y + 15, 5, 0, Math.PI * 2);
        this.ctx.arc(this.frog.x + 35, this.frog.y + 15, 5, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.beginPath();
        this.ctx.arc(this.frog.x + 25, this.frog.y + 25, 5, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    endGame() {
        console.log('endGame方法开始执行');
        
        this.gameStarted = false;
        clearInterval(this.gameInterval);
        clearInterval(this.timerInterval);
        
        if (this.startBtn) {
            this.startBtn.disabled = false;
        }
        
        const accuracy = this.jumpCount > 0 ? Math.round((this.correctJumps / this.jumpCount) * 100) : 0;
        const finalScore = this.score + accuracy;
        
        if (this.finalScoreElement) {
            this.finalScoreElement.textContent = finalScore;
        }
        if (this.accuracyElement) {
            this.accuracyElement.textContent = accuracy;
        }
        if (this.resultElement) {
            this.resultElement.style.display = 'block';
        }
        if (this.statusElement) {
            this.statusElement.textContent = '游戏结束';
        }
        
        console.log('endGame方法执行完成');
    }
}

console.log('script.js文件加载成功');

window.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded事件触发');
    try {
        console.log('开始创建FrogGame实例');
        new FrogGame();
        console.log('FrogGame实例创建完成');
    } catch (error) {
        console.error('创建FrogGame实例时出错:', error);
        // 尝试在页面上显示错误信息
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = '初始化失败: ' + error.message;
        }
    }
});