
        // 游戏状态
        let gameRunning = false;
        let players = [];
        let currentAction = "";
        let isUsingMockData = false;
        
        // 跳跃判断方式开关：true 为基于上半身，false 为基于下半身（默认）
        let useUpperBodyJumpDetection = true;
        
        // 共用滑动图片状态
        let sharedSlidingImage = null;
        let isSlidingImageVisible = false;
        let isSlidingPaused = false;
        let isObjectsPaused = false;
        let isJumpDisabled = false;
        let isInProximity = false;
        
        // 游戏参数
        const startButton = document.getElementById('start-button');
        const gameContainer = document.querySelector('.game-container');
        
        // 动作识别相关
        let actionCapture = null;
        
        // 玩家数据结构
        function createPlayer(id) {
            return {
                id: id,
                gameArea: document.getElementById(`game-area-${id}`),
                character: document.getElementById(`character-${id}`),
                expressionImage: document.getElementById(`expression-image-${id}`),
                objects: [],
                currentAction: "未检测到人",
                gameRunning: false,
                score: 0,
                avatar: '',
                isCollisionExpression: false
            };
        }
        
        // 初始化共用滑动效果
        function initSharedSliding() {
            sharedSlidingImage = document.getElementById('sliding-image');
            if (!sharedSlidingImage) return;
            
            let isSwitched = false;
            let switchTimeout = null;
            
            // 滑动函数
            function slideIn() {
                console.log('slideIn called');
                
                // 检查是否有任何一个玩家的游戏正在运行
                const anyPlayerRunning = players.some(player => player.gameRunning);
                if (!anyPlayerRunning) {
                    console.log('No player game running, waiting...');
                    setTimeout(slideIn, 500);
                    return;
                }
                
                console.log('Player game is running, starting slide');
                
                // 随机决定滑动方向：true为从左到右，false为从右到左
                const slideFromLeft = Math.random() > 0.5;
                console.log('Slide direction:', slideFromLeft ? 'left to right' : 'right to left');
                
                // 随机选择一个玩家的表情图片
                const playerIndex = Math.floor(Math.random() * 4) + 1;
                const expressionImage = document.getElementById(`expression-image-${playerIndex}`);
                
                if (!expressionImage) {
                    console.log('Expression image not found for player', playerIndex);
                    setTimeout(slideIn, 500);
                    return;
                }
                
                console.log('Selected player:', playerIndex);
                
                // 重置位置
                sharedSlidingImage.style.transition = 'none';
                
                // 计算表情图片的位置
                const expressionRect = expressionImage.getBoundingClientRect();
                const gameContainerRect = gameContainer.getBoundingClientRect();
                const expressionTop = expressionRect.top - gameContainerRect.top;
                const expressionLeft = expressionRect.left - gameContainerRect.left;
                const expressionWidth = expressionRect.width;
                
                console.log('Expression position:', { top: expressionTop, left: expressionLeft, width: expressionWidth });
                
                // 计算滑动图片高度（考虑padding-bottom的情况）
                const slidingImageHeight = sharedSlidingImage.offsetHeight || sharedSlidingImage.offsetWidth || 90; // 使用宽度作为高度的fallback
                console.log('Sliding image height:', slidingImageHeight);
                
                // 设置图片顶部位置为表情图片正上方3像素
                const slidingTop = expressionTop - 3 - slidingImageHeight;
                sharedSlidingImage.style.top = slidingTop + 'px';
                console.log('Sliding image top position:', slidingTop);
                
                // 根据方向设置初始位置和目标位置，确保完整滑动整个游戏容器
                let startLeft, targetLeft;
                if (slideFromLeft) {
                    // 从左到右：从容器左侧外开始，滑动到容器右侧外
                    startLeft = -200;
                    targetLeft = gameContainer.offsetWidth + 200;
                } else {
                    // 从右到左：从容器右侧外开始，滑动到容器左侧外
                    startLeft = gameContainer.offsetWidth + 200;
                    targetLeft = -200;
                }
                sharedSlidingImage.style.left = startLeft + 'px';
                console.log('Sliding image start left position:', startLeft);
                
                // 确保滑动图片可见
                sharedSlidingImage.style.display = 'block';
                sharedSlidingImage.style.visibility = 'visible';
                sharedSlidingImage.style.opacity = '1';
                
                console.log('Sliding image visibility set to visible');
                
                isSwitched = false;
                isSlidingImageVisible = false;
                isInProximity = false;
                
                // 强制重排
                sharedSlidingImage.offsetHeight;
                
                console.log('Sliding image target position:', targetLeft);
                
                // 生成80-120像素/秒之间的随机速度
                const speed = Math.random() * 40 + 80;
                const slideDistance = Math.abs(targetLeft - startLeft);
                const transitionTime = slideDistance / speed;
                console.log('Sliding speed:', speed, 'px/s, transition time:', transitionTime, 's');
                
                // 开始滑动
                sharedSlidingImage.style.transition = `left ${transitionTime}s linear`;
                sharedSlidingImage.style.left = targetLeft + 'px';
                
                console.log('Sliding started');
                
                // 定期检查碰撞
                const checkInterval = setInterval(() => {
                    if (!sharedSlidingImage) return;
                    
                    const slidingRect = sharedSlidingImage.getBoundingClientRect();
                    
                    players.forEach(player => {
                        if (!player.expressionImage || !player.character || !player.gameRunning) return;
                        
                        // 检查角色是否在跳跃
                        if (player.character.classList.contains('jumping')) {
                            const expressionRect = player.expressionImage.getBoundingClientRect();
                            
                            // 检测滑动图片与该玩家是否相交
                            const isColliding = !(slidingRect.right < expressionRect.left || 
                                                 slidingRect.left > expressionRect.right || 
                                                 slidingRect.bottom < expressionRect.top || 
                                                 slidingRect.top > expressionRect.bottom);
                            
                            if (isColliding) {
                                // 设置碰撞表情标志
                                player.isCollisionExpression = true;
                                
                                // 切换到开心表情
                                console.log('玩家', player.id, '跳跃碰到滑动图片，切换到开心表情');
                                if (player.expressionImage) {
                                    player.expressionImage.src = expressions.proud;
                                    player.character.style.backgroundColor = "transparent";
                                }
                                
                                // 滑动图片碰撞 +5分
                                updatePlayerScore(player, 5);
                                
                                // 显示弹幕
                                console.log('显示弹幕: 好吃！');
                                
                                // 创建并显示弹幕
                                const characterRect = player.character.getBoundingClientRect();
                                const gameAreaRect = player.gameArea.getBoundingClientRect();
                                
                                const messageElement = document.createElement('div');
                                messageElement.className = '弹幕';
                                messageElement.textContent = '好吃！';
                                messageElement.style.left = `${characterRect.left - gameAreaRect.left + characterRect.width / 2}px`;
                                messageElement.style.top = `${characterRect.top - gameAreaRect.top - 50}px`;
                                messageElement.style.transform = 'translateX(-50%)';
                                
                                player.gameArea.appendChild(messageElement);
                                
                                setTimeout(() => {
                                    if (messageElement.parentNode) {
                                        messageElement.parentNode.removeChild(messageElement);
                                    }
                                }, 2000);
                                
                                // 2秒后恢复默认表情
                                setTimeout(() => {
                                    console.log('恢复默认表情');
                                    if (player.expressionImage) {
                                        player.expressionImage.src = expressions.default;
                                        player.character.style.backgroundColor = "transparent";
                                    }
                                    // 重置碰撞表情标志
                                    player.isCollisionExpression = false;
                                }, 2000);
                            }
                        }
                    });
                }, 50);
                
                // 滑动完成后，随机延迟后再次滑动
                sharedSlidingImage.addEventListener('transitionend', function onTransitionEnd() {
                    sharedSlidingImage.removeEventListener('transitionend', onTransitionEnd);
                    clearInterval(checkInterval);
                    console.log('Sliding completed');
                    
                    // 随机延迟3-8秒后再次滑动
                    const delay = Math.random() * 5000 + 3000;
                    console.log('Waiting', delay, 'ms before next slide');
                    setTimeout(slideIn, delay);
                });
            }
            
            // 开始第一次滑动
            setTimeout(slideIn, 1000);
        }
        
        // 初始化游戏
        function initGame() {
            // 创建4个玩家
            for (let i = 1; i <= 4; i++) {
                players.push(createPlayer(i));
            }
            
            startButton.addEventListener('click', toggleGame);
            
            // 初始化默认表情
            players.forEach(player => {
                if (player.expressionImage) {
                    player.expressionImage.src = expressions.default;
                    player.character.style.backgroundColor = "transparent";
                }
            });
            
            // 初始化动作捕捉
            actionCapture = new ActionCapture();
            
            // 初始化共用滑动图片
            initSharedSliding();
            
            // 启动游戏主循环
            startGame();
        }
        
        // 模拟动作数据
        function startMockActionData() {
            isUsingMockData = true;
            console.log('开始使用模拟动作数据');
            
            const actions = ['站立', '举起双手', '双手抱头', '举起右手', '跳起来'];
            let currentIndex = 0;
            
            setInterval(() => {
                currentAction = actions[currentIndex];
                currentIndex = (currentIndex + 1) % actions.length;
                console.log('模拟动作:', currentAction);
                
                const actionDisplay = document.getElementById('action-display');
                if (actionDisplay) {
                    actionDisplay.textContent = currentAction;
                }
            }, 3000);
        }
        
        class ActionCapture {
            constructor() {
                this.videoElement = document.getElementById('camera');
                this.actionDisplay = document.getElementById('action-display');
                
                this.isCameraStarted = false;
                this.isRecognizing = false;
                this.pose = null;
                this.camera = null;
                
                this.headPositionHistory = [];
                this.maxHeadHistoryPoints = 20;
                this.verticalPositionHistory = [];
                this.maxVerticalHistoryPoints = 30;
                
                this.baselineHipY = null;
                this.baselineSetTime = 0;
                this.lastKneeY = null;
                this.jumpDetected = false;
                this.jumpStartTime = 0;
                this.hipYHistory = [];

                this.init();
            }

            init() {
                this.setupCamera();
            }

            async setupCamera() {
                if (this.isCameraStarted) return;

                try {
                    console.log('开始设置摄像头');
                    this.actionDisplay.textContent = '正在设置摄像头...';

                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                        throw new Error('浏览器不支持摄像头访问');
                    }

                    console.log('正在获取摄像头设备列表');
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const videoDevices = devices.filter(device => device.kind === 'videoinput');
                    console.log('找到的摄像头设备:', videoDevices);

                    if (videoDevices.length === 0) {
                        throw new Error('未找到摄像头设备');
                    }

                    console.log('正在请求摄像头权限');
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            width: 640,
                            height: 480,
                            deviceId: videoDevices[0].deviceId
                        },
                        audio: false
                    });
                    console.log('摄像头权限获取成功');

                    this.videoElement.srcObject = stream;
                    console.log('视频源设置成功');

                    this.videoElement.onloadedmetadata = async () => {
                        try {
                            console.log('视频元数据加载完成，开始播放');
                            await this.videoElement.play();
                            console.log('视频播放成功');
                            this.actionDisplay.textContent = '摄像头已就绪';

                            console.log('开始初始化MediaPipe Pose');
                            // 检测是否为移动端
                            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                            console.log('是否为移动端:', isMobile);
                            
                            this.isMobile = isMobile; // 保存设备类型供后续使用
                            
                            this.pose = new Pose({
                                locateFile: (file) => {
                                    console.log('加载文件:', file);
                                    return `mediapipe/${file}`;
                                }
                            });

                            this.pose.setOptions({
                                modelComplexity: isMobile ? 0 : 1, // 移动端使用最低复杂度，PC端使用中等复杂度
                                smoothLandmarks: true,
                                enableSegmentation: false,
                                smoothSegmentation: false,
                                minDetectionConfidence: 0.3,
                                minTrackingConfidence: 0.3,
                                selfieMode: false
                            });

                            this.pose.onResults((results) => this.onPoseResults(results));

                            try {
                                console.log('开始初始化Pose模型...');
                                await this.pose.initialize();
                                console.log('MediaPipe Pose初始化成功');
                            } catch (initError) {
                                console.error('Pose初始化失败:', initError);
                                this.actionDisplay.textContent = 'Pose初始化失败: ' + initError.message;
                                return;
                            }

                            this.isCameraStarted = true;
                            this.isRecognizing = true;
                            
                            // 启动游戏循环
                            gameLoop();
                            
                            const processFrame = async () => {
                                if (this.isRecognizing && this.videoElement.readyState >= 2) {
                                    await this.pose.send({image: this.videoElement});
                                }
                                requestAnimationFrame(processFrame);
                            };
                            processFrame();
                            console.log('开始处理视频帧');

                        } catch (playError) {
                            console.error('视频播放失败:', playError);
                            this.actionDisplay.textContent = '视频播放失败';
                        }
                    };

                    this.videoElement.onerror = (error) => {
                        console.error('视频元素错误:', error);
                        this.actionDisplay.textContent = '视频元素错误';
                    };
                    
                } catch (error) {
                    console.error('设置失败:', error);
                    this.actionDisplay.textContent = '摄像头访问失败: ' + error.message + '，使用模拟数据';
                    this.isCameraStarted = false;
                    this.isRecognizing = false;
                    startMockActionData();
                }
            }

            onPoseResults(results) {
                console.log('Pose检测结果:', results);
                
                // PC端支持多人检测，移动端只支持单人
                if (!this.isMobile && results.multiPoseLandmarks && results.multiPoseLandmarks.length > 0) {
                    // PC端多人模式：results.multiPoseLandmarks 是数组
                    console.log('PC端检测到多人:', results.multiPoseLandmarks.length);
                    this.processMultiplePoses(results.multiPoseLandmarks);
                } else if (results.poseLandmarks) {
                    // 单人模式：results.poseLandmarks 是单个对象
                    // 对于单人模式，将其分配给玩家1
                    console.log('单人模式，分配给玩家1');
                    this.updatePlayerAction(1, results.poseLandmarks);
                    // 清空其他玩家的动作
                    for (let i = 2; i <= 4; i++) {
                        this.clearPlayerAction(i);
                    }
                } else {
                    // 没有检测到任何人，清空所有玩家的动作
                    console.log('未检测到任何人');
                    for (let i = 1; i <= 4; i++) {
                        this.clearPlayerAction(i);
                    }
                }
            }

            processMultiplePoses(poses) {
                // 1. 按水平位置排序（从左到右）
                // 注意：当selfieMode为true时，MediaPipe已经处理了镜像，所以坐标是正确的
                const sortedPoses = poses
                    .filter(pose => pose && pose[0]) // 确保有姿态数据和鼻子点
                    .sort((a, b) => a[0].x - b[0].x);

                // 2. 分配到4个玩家位置
                const maxPlayers = 4;
                for (let i = 0; i < maxPlayers; i++) {
                    if (i < sortedPoses.length) {
                        const pose = sortedPoses[i];
                        this.updatePlayerAction(i + 1, pose);
                    } else {
                        // 没有足够的人，清空对应的玩家动作
                        this.clearPlayerAction(i + 1);
                    }
                }
            }

            updatePlayerAction(playerIndex, landmarks) {
                // 为特定玩家更新动作
                const action = this.recognizeActionForPlayer(landmarks);
                
                // 找到对应的玩家
                const player = players.find(p => p.id === playerIndex);
                if (player) {
                    // 更新玩家的动作状态
                    player.currentAction = action;
 
                    
                    // 显示动作到对应的玩家区域
                    const actionDisplay = document.getElementById(`action-display-${playerIndex}`);
                    if (actionDisplay) {
                        // 如果游戏未运行，显示"举起右手开始"
                        if (!player.gameRunning) {
                            actionDisplay.textContent = "举起右手开始";
                        } else {
                            // 游戏运行中，显示实际动作
                            actionDisplay.textContent = action;
                        }
                    }
                    
                    // 根据动作更新表情，只有当没有碰撞表情切换时才更新
                    if (player.expressionImage && !player.isCollisionExpression) {
                        if (player.currentAction === "举起双手" ||player.currentAction === "双手举起"||player.currentAction === "双手上举") {
                            player.expressionImage.src = expressions.handup;
                        } else if (player.currentAction === "跳起来") {
                            player.expressionImage.src = expressions.fly;
                        // } else if (player.currentAction === "双手抱头") {
                        //     player.expressionImage.src = expressions.danger;
                        } else if (player.currentAction === "张开双手") {
                            player.expressionImage.src = expressions.danger;
                        } else {
                            // 其他动作恢复默认表情
                            player.expressionImage.src = expressions.default;
                        }
                    }
                    
                    // 游戏开始判断：如果玩家举起右手且游戏未运行，则启动该玩家的游戏
                    if (action === "举起右手" && !player.gameRunning) {
                        togglePlayerGame(playerIndex);
                    }
                    
                    // 举起左手的判断暂时保留，但是不响应任何逻辑
                    // if (action === "左手举起" && player.gameRunning) {
                    //     togglePlayerGame(playerIndex);
                    // }
                    
                    // 跳跃逻辑：只针对当前玩家
                    if (action === "跳起来" && !isJumpDisabled) {
                        const character = player.character;
                        if (character && !character.classList.contains('jumping') && !character.classList.contains('jump-cooling')) {
                            character.classList.add('jumping');
                            character.style.transform = 'translateY(-120px)';
                            setTimeout(() => {
                                character.style.transform = 'translateY(0)';
                                character.classList.remove('jumping');
                                character.classList.add('jump-cooling');
                                setTimeout(() => {
                                    character.classList.remove('jump-cooling');
                                }, 2000);
                            }, 2000);
                        }
                    }
                }
            }

            clearPlayerAction(playerIndex) {
                // 清空玩家的动作状态
                const player = players.find(p => p.id === playerIndex);
                if (player) {
                    player.currentAction = "未检测到人";
                    
                    const actionDisplay = document.getElementById(`action-display-${playerIndex}`);
                    if (actionDisplay) {
                        actionDisplay.textContent = "未检测到人";
                    }
                }
            }

            recognizeActionForPlayer(landmarks) {
                // 检查是否有足够的关键点
                const requiredLandmarks = [0, 11, 12, 15, 16, 23, 24]; // 鼻子、左右肩膀、左右手腕、左右髋部
                const hasRequiredLandmarks = requiredLandmarks.every(idx => landmarks[idx]);
                
                if (!hasRequiredLandmarks) {
                    return "未检测到完整姿态";
                }

                const leftShoulder = landmarks[11];
                const rightShoulder = landmarks[12];
                const leftWrist = landmarks[15];
                const rightWrist = landmarks[16];
                const nose = landmarks[0];
                const leftHip = landmarks[23];
                const rightHip = landmarks[24];

                const calculateDistance = (point1, point2) => {
                    return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2));
                };

                const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
                const armRaisedThreshold = Math.max(0.1, shoulderWidth * 0.3);

                const leftArmRaised = leftShoulder.y - leftWrist.y > armRaisedThreshold;
                const rightArmRaised = rightShoulder.y - rightWrist.y > armRaisedThreshold;

                const leftWristToNose = calculateDistance(leftWrist, nose);
                const rightWristToNose = calculateDistance(rightWrist, nose);
                const isHandsOnHead = leftWristToNose < 0.3 && rightWristToNose < 0.3;
                const isBothHandsRaised = leftArmRaised && rightArmRaised;
                const isRightHandRaised = rightArmRaised && !leftArmRaised;
                const isLeftHandRaised = leftArmRaised && !rightArmRaised;
                
                // 检测张开双手动作：手臂与肩膀大致水平
                const isArmsHorizontal = Math.abs(leftWrist.y - leftShoulder.y) < shoulderWidth * 0.9 && 
                                        Math.abs(rightWrist.y - rightShoulder.y) < shoulderWidth * 0.9;
                const isHandsOpen = isArmsHorizontal;
                
                // 检测跳跃
                let isJumping = false;
                if (useUpperBodyJumpDetection) {
                    // 基于上半身的跳跃判断 - 降低阈值以减少误判
                    const upperBodyY = (nose.y + leftShoulder.y + rightShoulder.y) / 3;
                    isJumping = upperBodyY < 0.25;
                } else {
                    // 基于下半身的跳跃判断（默认）
                    const hipY = (leftHip.y + rightHip.y) / 2;
                    isJumping = hipY < 0.3;
                }

                // 简单的动作检测逻辑
                if (isHandsOpen) {
                    return "张开双手";
                // } else if (isHandsOnHead) {
                //     return "双手抱头";
                } else if (isBothHandsRaised) {
                    return "举起双手";
                } else if (isRightHandRaised) {
                    return "举起右手";
                } else if (isLeftHandRaised) {
                    return "举起左手";
                } else if (isJumping) {
                    return "跳起来";
                } else {
                    return "站立";
                }
            }

            updateHeadPositionHistory(landmarks) {
                const nose = landmarks[0];
                if (nose) {
                    this.headPositionHistory.push({
                        x: nose.x,
                        y: nose.y,
                        timestamp: Date.now()
                    });

                    if (this.headPositionHistory.length > this.maxHeadHistoryPoints) {
                        this.headPositionHistory.shift();
                    }
                }
            }

            updateVerticalPositionHistory(landmarks) {
                const nose = landmarks[0];
                if (nose) {
                    this.verticalPositionHistory.push({
                        y: nose.y,
                        timestamp: Date.now()
                    });

                    if (this.verticalPositionHistory.length > this.maxVerticalHistoryPoints) {
                        this.verticalPositionHistory.shift();
                    }
                }
            }

            detectHeadShake() {
                if (this.headPositionHistory.length < 10) {
                    return false;
                }

                const xValues = this.headPositionHistory.map(pos => pos.x);
                const minX = Math.min(...xValues);
                const maxX = Math.max(...xValues);
                const xRange = maxX - minX;

                let directionChanges = 0;
                let lastDirection = null;

                for (let i = 1; i < this.headPositionHistory.length; i++) {
                    const currentX = this.headPositionHistory[i].x;
                    const previousX = this.headPositionHistory[i-1].x;
                    const direction = currentX > previousX ? 'right' : 'left';

                    if (lastDirection && direction !== lastDirection) {
                        directionChanges++;
                    }
                    lastDirection = direction;
                }

                const recentHistory = this.headPositionHistory.filter(pos => 
                    Date.now() - pos.timestamp < 2000
                );

                return xRange > 0.1 && 
                       directionChanges >= 3 && 
                       recentHistory.length >= 8;
            }

            detectJump(landmarks) {
                const nose = landmarks[0];
                const leftHip = landmarks[23];
                const rightHip = landmarks[24];
                
                if (!nose || !leftHip || !rightHip) {
                    return false;
                }
                
                if (this.jumpStartTime && Date.now() - this.jumpStartTime > 2000) {
                    this.jumpStartTime = null;
                    return false;
                }
                
                const hipY = (leftHip.y + rightHip.y) / 2;
                const isJumping = hipY < 0.4;
                
                if (isJumping && !this.jumpStartTime) {
                    this.jumpStartTime = Date.now();
                }
                
                return isJumping;
            }

            recognizeAction(landmarks) {
                const leftShoulder = landmarks[11];
                const rightShoulder = landmarks[12];
                const leftWrist = landmarks[15];
                const rightWrist = landmarks[16];
                const nose = landmarks[0];

                if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist || !nose) {
                    currentAction = "未检测到完整姿态";
                    this.updateActionDisplay();
                    return;
                }

                const calculateDistance = (point1, point2) => {
                    return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2));
                };

                const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
                const armRaisedThreshold = Math.max(0.1, shoulderWidth * 0.3);

                const leftArmRaised = leftShoulder.y - leftWrist.y > armRaisedThreshold;
                const rightArmRaised = rightShoulder.y - rightWrist.y > armRaisedThreshold;

                const leftWristToNose = calculateDistance(leftWrist, nose);
                const rightWristToNose = calculateDistance(rightWrist, nose);
                const isHandsOnHead = leftWristToNose < 0.3 && rightWristToNose < 0.3;
                const isBothHandsRaised = leftArmRaised && rightArmRaised;
                const isRightHandRaised = rightArmRaised && !leftArmRaised;

                let detectedAction = '站立';

                if (isRightHandRaised) {
                    detectedAction = '举起右手';
                }
                else if (isHandsOnHead) {
                    detectedAction = '双手抱头';
                }
                else if (isBothHandsRaised) {
                    detectedAction = '举起双手';
                }

                currentAction = detectedAction;
                this.updateActionDisplay();

                if (detectedAction === '跳起来') {
                    players.forEach(player => {
                        if (!isJumpDisabled) {
                            const character = player.character;
                            if (character && !character.classList.contains('jumping') && !character.classList.contains('jump-cooling')) {
                                character.classList.add('jumping');
                                character.style.transform = 'translateY(-120px)';
                                setTimeout(() => {
                                    character.style.transform = 'translateY(0)';
                                    character.classList.remove('jumping');
                                    character.classList.add('jump-cooling');
                                    setTimeout(() => {
                                        character.classList.remove('jump-cooling');
                                    }, 2000);
                                }, 2000);
                            }
                        }
                    });
                }

                if (!gameRunning) {
                    if (detectedAction === '举起右手') {
                        toggleGame();
                    }
                }
            }

            updateActionDisplay() {
                if (this.actionDisplay) {
                    this.actionDisplay.textContent = currentAction;
                }
            }
        }
        
        // 切换游戏状态
        function toggleGame() {
            gameRunning = !gameRunning;
            
            if (gameRunning) {
                startButton.textContent = "停止游戏";
                startButton.style.background = "#f44336";
                // 开始所有玩家的游戏
                players.forEach(player => {
                    if (!player.gameRunning) {
                        togglePlayerGame(player.id);
                    }
                });
            } else {
                startButton.textContent = "开始游戏";
                startButton.style.background = "#4CAF50";
                // 停止所有玩家的游戏
                players.forEach(player => {
                    if (player.gameRunning) {
                        togglePlayerGame(player.id);
                    }
                });
                // 显示游戏排名
                showGameRankings();
            }
        }
        
        // 切换玩家游戏状态
        // 处理玩家头像
        function capturePlayerAvatar(playerIndex) {
            const video = document.getElementById('camera');
            if (!video || !video.srcObject) return;

            // 创建canvas用于拍照
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // 假设使用MediaPipe Face Mesh进行人脸检测
            // 这里简化处理，直接截取中心区域作为头像
            const faceSize = Math.min(canvas.width, canvas.height) * 0.3;
            const faceX = (canvas.width - faceSize) / 2;
            const faceY = (canvas.height - faceSize) / 2;

            // 创建新的canvas用于截取头像
            const avatarCanvas = document.createElement('canvas');
            avatarCanvas.width = faceSize;
            avatarCanvas.height = faceSize;
            const avatarCtx = avatarCanvas.getContext('2d');
            avatarCtx.drawImage(canvas, faceX, faceY, faceSize, faceSize, 0, 0, faceSize, faceSize);

            // 转换为base64
            const avatarDataUrl = avatarCanvas.toDataURL('image/png');

            // 显示头像
            const avatarElement = document.getElementById(`player-avatar-${playerIndex}`);
            if (avatarElement) {
                avatarElement.style.backgroundImage = `url('${avatarDataUrl}')`;
            }
            
            // 更新玩家对象的avatar属性
            const player = players.find(p => p.id === playerIndex);
            if (player) {
                player.avatar = avatarDataUrl;
                console.log(`Updated avatar for player ${playerIndex}:`, avatarDataUrl);
            }
        }

        function togglePlayerGame(playerIndex) {
            const player = players.find(p => p.id === playerIndex);
            if (!player) return;
            
            // 获取玩家区域元素
            const playerArea = document.querySelector(`.player-area:nth-child(${playerIndex})`);
            
            player.gameRunning = !player.gameRunning;
            
            if (player.gameRunning) {
                // 开始该玩家的游戏
                player.objects = [];
                // 清零积分
                player.score = 0;
                // 更新积分显示
                const scoreDisplay = document.getElementById(`score-display-${player.id}`);
                if (scoreDisplay) {
                    scoreDisplay.textContent = `积分: ${player.score}`;
                }
                spawnObjects(player);
                
                // 添加game-running类
                if (playerArea) {
                    playerArea.classList.add('game-running');
                }
                
                // 拍摄玩家头像
                capturePlayerAvatar(playerIndex);
            } else {
                // 停止该玩家的游戏
                player.objects.forEach(obj => {
                    if (obj.element && obj.element.parentNode) {
                        player.gameArea.removeChild(obj.element);
                    }
                });
                player.objects = [];
                
                // 移除game-running类
                if (playerArea) {
                    playerArea.classList.remove('game-running');
                }
            }
        }
        
        // 开始游戏
        function startGame() {
            players.forEach(player => {
                player.objects = [];
            });
            
            gameLoop();
            
            players.forEach(player => {
                spawnObjects(player);
            });
        }
        
        // 停止游戏
        function stopGame() {
            players.forEach(player => {
                player.objects.forEach(obj => {
                    if (obj.element) {
                        player.gameArea.removeChild(obj.element);
                    }
                });
                player.objects = [];
            });
            
            // 显示游戏结束排名
            showGameRankings();
        }
        
        // 显示游戏排名
        function showGameRankings() {
            // 按分数排序玩家
            const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
            const topPlayers = sortedPlayers.slice(0, 3);
            
            // 创建排名浮窗
            const rankingContainer = document.createElement('div');
            rankingContainer.id = 'game-rankings';
            
            // 生成领奖台内容
            const podiumContent = topPlayers.map((player, index) => {
                // 直接从玩家对象获取头像
                let avatarStyle = '';
                if (player.avatar) {
                    avatarStyle = `background-image: url('${player.avatar}');`;
                    console.log(`Using avatar from player object for player ${player.id}`);
                } else {
                    console.log(`No avatar found in player object for player ${player.id}`);
                    // 如果没有头像，使用默认头像
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
            
            rankingContainer.innerHTML = `
                <div class="ranking-header">
                    <h2>游戏排名</h2>
                    <button id="close-ranking">×</button>
                </div>
                <div class="ranking-content">
                    <div class="podium">
                        ${podiumContent}
                    </div>
                </div>
            `;
            
            document.body.appendChild(rankingContainer);
            
            // 关闭按钮事件
            document.getElementById('close-ranking').addEventListener('click', () => {
                document.body.removeChild(rankingContainer);
            });
        }
        
        // 游戏主循环
        function gameLoop() {
            // 继续运行游戏循环，但是只处理正在运行的玩家
            players.forEach(player => {
                if (player.gameRunning) {
                    updateObjects(player);
                    checkCollisions(player);
                }
            });
            
            requestAnimationFrame(gameLoop);
        }
        
        // 生成物体
        function spawnObjects(player) {
            if (!player.gameRunning) return;
            
            const characterRect = player.character.getBoundingClientRect();
            const gameAreaRect = player.gameArea.getBoundingClientRect();
            const characterCenterX = characterRect.left - gameAreaRect.left + characterRect.width / 2;
            
            const relativeUnit = player.gameArea.offsetHeight * 0.01;
            const horizontalRange = relativeUnit * 6;
            const object = {
                type: Math.random() > 0.5 ? 'gold' : 'stone',
                x: characterCenterX + (Math.random() * horizontalRange - horizontalRange / 0.9 ),
                y: -relativeUnit * 4,
                speed: Math.random() * relativeUnit * 0.6 + relativeUnit * 0.6,
                // speed: Math.random() * relativeUnit * 0.6  ,
                originalSpeed: 0,
                element: null
            };
            
            object.originalSpeed = object.speed;

            if (isSlidingImageVisible) {
                object.speed = object.originalSpeed / 2;
            }

            const objectSize = player.gameArea.offsetWidth * 0.2;
            if (object.x < 0) object.x = 0;
            if (object.x > player.gameArea.offsetWidth - objectSize) object.x = player.gameArea.offsetWidth - objectSize;
            
            const objElement = document.createElement('div');
            objElement.className = `object ${object.type}`;
            objElement.style.left = `${object.x}px`;
            objElement.style.top = `${object.y}px`;
            objElement.style.width = `${objectSize}px`;
            objElement.style.height = `${objectSize}px`;
            player.gameArea.appendChild(objElement);
            
            object.element = objElement;
            player.objects.push(object);
        }
        
        // 检查并生成下一个物体
        function checkAndSpawnNextObject(player) {
            if (!player.gameRunning) return;
            
            if (player.objects.length === 0) {
                const delay = Math.random() * 2000;
                setTimeout(() => {
                    spawnObjects(player);
                }, delay);
            }
        }
        
        // 更新物体位置
        function updateObjects(player) {
            if (!player.character || !player.gameRunning) return;
            
            const characterRect = player.character.getBoundingClientRect();
            const gameAreaRect = player.gameArea.getBoundingClientRect();
            const characterTop = characterRect.top - gameAreaRect.top;
            
            const relativeUnit = player.gameArea.offsetHeight * 0.01;
            const proximityTop = characterTop - 130;
            
            player.objects.forEach((obj, index) => {
                if (isSlidingImageVisible) {
                    obj.speed = obj.originalSpeed / 2;
                } else {
                    obj.speed = obj.originalSpeed;
                }
                
                if (isObjectsPaused) {
                    obj.speed = 0;
                } else if (isInProximity) {
                    if (obj.y < proximityTop) {
                        obj.speed = 0;
                    } else {
                        obj.speed = obj.originalSpeed / 2;
                    }
                }
                
                obj.y += obj.speed;
                obj.element.style.top = `${obj.y}px`;
                
                if (obj.y > player.gameArea.offsetHeight) {
                    player.gameArea.removeChild(obj.element);
                    player.objects.splice(index, 1);
                    checkAndSpawnNextObject(player);
                }
            });
        }
        
        // 检测碰撞
        function checkCollisions(player) {
            if (!player.character || !player.expressionImage || !player.gameRunning) return;

            const expressionRect = player.expressionImage.getBoundingClientRect();
            const gameAreaRect = player.gameArea.getBoundingClientRect();

            // 计算表情图片的实际可见区域
            let charLeft = expressionRect.left - gameAreaRect.left;
            let charRight = expressionRect.right - gameAreaRect.left;
            let charTop = expressionRect.top - gameAreaRect.top;
            let charBottom = expressionRect.bottom - gameAreaRect.top;

            // 考虑object-fit: contain的情况，计算实际图片内容的边界
            const img = player.expressionImage;
            if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
                const imgAspectRatio = img.naturalWidth / img.naturalHeight;
                const containerAspectRatio = (charRight - charLeft) / (charBottom - charTop);

                if (imgAspectRatio > containerAspectRatio) {
                    // 图片比容器宽，垂直居中，计算实际高度
                    const actualHeight = (charRight - charLeft) / imgAspectRatio;
                    const padding = ((charBottom - charTop) - actualHeight) / 2;
                    charTop += padding;
                    charBottom -= padding;
                } else {
                    // 图片比容器高，水平居中，计算实际宽度
                    const actualWidth = (charBottom - charTop) * imgAspectRatio;
                    const padding = ((charRight - charLeft) - actualWidth) / 2;
                    charLeft += padding;
                    charRight -= padding;
                }
            }

            player.objects.forEach((obj, index) => {
                const objRect = obj.element.getBoundingClientRect();

                // 计算石头/元宝的实际可见区域
                let objLeft = objRect.left - gameAreaRect.left;
                let objRight = objRect.right - gameAreaRect.left;
                let objTop = objRect.top - gameAreaRect.top;
                let objBottom = objRect.bottom - gameAreaRect.top;

                // 考虑background-size: contain的情况，计算实际图片内容的边界
                // 假设石头和元宝图片的原始宽高比例
                const objType = obj.type;
                let objAspectRatio = 1; // 默认正方形
                if (objType === 'gold') {
                    // 金元宝图片的宽高比例（根据实际图片调整）
                    objAspectRatio = 1; // 假设是正方形
                } else if (objType === 'stone') {
                    // 石头图片的宽高比例（根据实际图片调整）
                    objAspectRatio = 1; // 假设是正方形
                }

                const objContainerAspectRatio = (objRight - objLeft) / (objBottom - objTop);

                if (objAspectRatio > objContainerAspectRatio) {
                    // 图片比容器宽，垂直居中，计算实际高度
                    const actualHeight = (objRight - objLeft) / objAspectRatio;
                    const padding = ((objBottom - objTop) - actualHeight) / 2;
                    objTop += padding;
                    objBottom -= padding;
                } else {
                    // 图片比容器高，水平居中，计算实际宽度
                    const actualWidth = (objBottom - objTop) * objAspectRatio;
                    const padding = ((objRight - objLeft) - actualWidth) / 2;
                    objLeft += padding;
                    objRight -= padding;
                }

                // 调试信息
                if (objBottom > charTop && objTop < charBottom && objRight > charLeft && objLeft < charRight) {
                    console.log('碰撞检测触发:', {
                        obj: { top: objTop, bottom: objBottom, left: objLeft, right: objRight, height: objBottom - objTop },
                        char: { top: charTop, bottom: charBottom, left: charLeft, right: charRight, height: charBottom - charTop },
                        gameAreaHeight: gameAreaRect.height
                    });
                }

                if (objRight > charLeft + 15 && objLeft < charRight - 15 &&
                    objBottom > charTop + 15 && objTop < charBottom - 15) {

                    handleCollision(player, obj);

                    player.gameArea.removeChild(obj.element);
                    player.objects.splice(index, 1);

                    checkAndSpawnNextObject(player);
                }
            });
        }
        
        // 处理碰撞
        function handleCollision(player, obj) {
            let message = "";
            console.log("碰撞检测 - 玩家:", player.id, "物体类型:", obj.type, "当前动作:", player.currentAction);
            
            if (!player.character) {
                console.error("character元素不存在");
                return;
            }
            
            // 设置碰撞表情标志
            player.isCollisionExpression = true;
            
            if (obj.type === 'gold') {
                if (player.currentAction === "举起双手" || player.currentAction === "双手上举") {
                    message = "耶~~~";
                    console.log("显示弹幕: 耶~~~");
                    console.log("切换到开心表情");
                    if (player.expressionImage) {
                        player.expressionImage.src = expressions.happy;
                        player.character.style.backgroundColor = "transparent";
                    }
                    // 金元宝碰撞 +3分
                    updatePlayerScore(player, 3);
                } else {
                    console.log("金元宝落下但动作不是举起双手，不显示弹幕");
                    player.isCollisionExpression = false;
                }
            } else {
                if (player.currentAction === "双手抱头" || player.currentAction === "张开双手") {
                    message = "你真棒";
                    console.log("显示弹幕: 你真棒");
                    console.log("切换到得意表情");
                    if (player.expressionImage) {
                        player.expressionImage.src = expressions.proud;
                        player.character.style.backgroundColor = "transparent";
                    }
                } else {
                    message = "好痛啊";
                    console.log("显示弹幕: 好痛啊");
                    console.log("切换到哭的表情");
                    if (player.expressionImage) {
                        player.expressionImage.src = expressions.crying;
                        player.character.style.backgroundColor = "transparent";
                    }
                    // 石头碰撞 -2分
                    updatePlayerScore(player, -2);
                }
            }
            
            if (message) {
                showMessage(player, message);
            }
            
            setTimeout(() => {
                console.log("恢复默认表情");
                if (player.expressionImage) {
                    player.expressionImage.src = expressions.default;
                    player.character.style.backgroundColor = "transparent";
                }
                // 重置碰撞表情标志
                player.isCollisionExpression = false;
            }, 2000);
        }
        
        // 更新玩家积分
        function updatePlayerScore(player, points) {
            // 更新积分
            player.score += points;
            // 确保积分不会小于0
            if (player.score < 0) {
                player.score = 0;
            }
            
            // 更新积分显示
            const scoreDisplay = document.getElementById(`score-display-${player.id}`);
            if (scoreDisplay) {
                scoreDisplay.textContent = `积分: ${player.score}`;
                // 添加积分变动动画
                scoreDisplay.classList.add('score-change');
                setTimeout(() => {
                    scoreDisplay.classList.remove('score-change');
                }, 500);
            }
        }
        
        // 显示弹幕
        function showMessage(player, message) {
            const characterRect = player.character.getBoundingClientRect();
            const gameAreaRect = player.gameArea.getBoundingClientRect();
            
            const messageElement = document.createElement('div');
            messageElement.className = '弹幕';
            messageElement.textContent = message;
            messageElement.style.left = `${characterRect.left - gameAreaRect.left + characterRect.width / 2}px`;
            messageElement.style.top = `${characterRect.top - gameAreaRect.top - 50}px`;
            messageElement.style.transform = 'translateX(-50%)';
            
            player.gameArea.appendChild(messageElement);
            
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 2000);
        }
        
        // 初始化游戏
        initGame();
    