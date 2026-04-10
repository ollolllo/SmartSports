/**
 * MediaPipe Pose 姿态动作识别工具
 * 用于从 MediaPipe Pose 检测的关键点数组中识别用户动作
 *
 * @author SmartSports Team
 * @version 1.0.0
 */

/**
 * 姿态关键点索引常量
 * 对应 MediaPipe Pose 的 33 个关键点
 */
const LANDMARK_INDEX = {
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

/**
 * 动作类型枚举
 */
const ACTION_TYPE = {
    STANDING: '站立',
    RIGHT_HAND_RAISED: '举起右手',
    LEFT_HAND_RAISED: '举起左手',
    BOTH_HANDS_RAISED: '举起双手',
    HANDS_OPEN: '张开双手',
    JUMPING: '跳起来',
    HANDS_ON_HEAD: '双手抱头',
    INCOMPLETE: '未检测到完整姿态'
};

/**
 * 检测姿态关键点是否完整
 *
 * @param {Array} landmarks - MediaPipe Pose 返回的关键点数组
 * @param {Array} requiredIndices - 需要的关键点索引数组，默认检测基础7点
 * @returns {boolean} - 关键点是否完整
 *
 * @example
 * const landmarks = results.poseLandmarks;
 * if (isValidLandmarks(landmarks)) {
 *     // 执行动作识别
 * }
 */
function isValidLandmarks(landmarks, requiredIndices = [0, 11, 12, 15, 16, 23, 24]) {
    if (!landmarks || !Array.isArray(landmarks)) {
        return false;
    }
    return requiredIndices.every(idx => landmarks[idx]);
}

/**
 * 计算两点之间的欧几里得距离
 *
 * @param {Object} point1 - 第一个点 {x, y}
 * @param {Object} point2 - 第二个点 {x, y}
 * @returns {number} - 两点之间的距离
 */
function calculateDistance(point1, point2) {
    return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2));
}

/**
 * 识别单个人体的姿态动作
 *
 * @param {Array} landmarks - MediaPipe Pose 返回的关键点数组
 * @param {Object} options - 配置选项
 * @param {boolean} options.useUpperBodyJumpDetection - 使用上半身判断跳跃（默认 true），false 则使用下半身
 * @param {number} options.armRaisedThresholdRatio - 抬手阈值比例（默认 0.3）
 * @param {number} options.jumpUpperThreshold - 上半身跳跃阈值（默认 0.25）
 * @param {number} options.jumpLowerThreshold - 下半身跳跃阈值（默认 0.3）
 * @param {number} options.handsOnHeadThreshold - 双手抱头距离阈值（默认 0.3）
 *
 * @returns {string} - 识别到的动作字符串
 *
 * @description
 * 检测的动作类型（按优先级排序）：
 * 1. 张开双手 - 双臂水平展开
 * 2. 举起双手 - 双手同时上举
 * 3. 举起右手 - 仅右手上举
 * 4. 举起左手 - 仅左手上举
 * 5. 跳起来 - 身体向上跃起
 * 6. 站立 - 常态站立
 *
 * @example
 * // 基础用法
 * const action = recognizeAction(landmarks);
 * console.log(action); // "举起右手"
 *
 * @example
 * // 自定义配置
 * const action = recognizeAction(landmarks, {
 *     useUpperBodyJumpDetection: false,
 *     armRaisedThresholdRatio: 0.3
 * });
 */
function recognizeAction(landmarks, options = {}) {
    const defaultOptions = {
        useUpperBodyJumpDetection: true,
        armRaisedThresholdRatio: 0.3,
        jumpUpperThreshold: 0.25,
        jumpLowerThreshold: 0.3,
        handsOnHeadThreshold: 0.3
    };

    const config = { ...defaultOptions, ...options };

    if (!isValidLandmarks(landmarks)) {
        return ACTION_TYPE.INCOMPLETE;
    }

    const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
    const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
    const leftWrist = landmarks[LANDMARK_INDEX.LEFT_WRIST];
    const rightWrist = landmarks[LANDMARK_INDEX.RIGHT_WRIST];
    const nose = landmarks[LANDMARK_INDEX.NOSE];
    const leftHip = landmarks[LANDMARK_INDEX.LEFT_HIP];
    const rightHip = landmarks[LANDMARK_INDEX.RIGHT_HIP];

    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    const armRaisedThreshold = Math.max(0.1, shoulderWidth * config.armRaisedThresholdRatio);

    const leftArmRaised = leftShoulder.y - leftWrist.y > armRaisedThreshold;
    const rightArmRaised = rightShoulder.y - rightWrist.y > armRaisedThreshold;

    const leftWristToNose = calculateDistance(leftWrist, nose);
    const rightWristToNose = calculateDistance(rightWrist, nose);
    const isHandsOnHead = leftWristToNose < config.handsOnHeadThreshold &&
                          rightWristToNose < config.handsOnHeadThreshold;

    const isBothHandsRaised = leftArmRaised && rightArmRaised;
    const isRightHandRaised = rightArmRaised && !leftArmRaised;
    const isLeftHandRaised = leftArmRaised && !rightArmRaised;

    const isArmsHorizontal = Math.abs(leftWrist.y - leftShoulder.y) < shoulderWidth * 0.9 &&
                            Math.abs(rightWrist.y - rightShoulder.y) < shoulderWidth * 0.9;
    const isHandsOpen = isArmsHorizontal;

    let isJumping = false;
    if (config.useUpperBodyJumpDetection) {
        const upperBodyY = (nose.y + leftShoulder.y + rightShoulder.y) / 3;
        isJumping = upperBodyY < config.jumpUpperThreshold;
    } else {
        const hipY = (leftHip.y + rightHip.y) / 2;
        isJumping = hipY < config.jumpLowerThreshold;
    }

    if (isHandsOpen) {
        return ACTION_TYPE.HANDS_OPEN;
    } else if (isHandsOnHead) {
        return ACTION_TYPE.HANDS_ON_HEAD;
    } else if (isBothHandsRaised) {
        return ACTION_TYPE.BOTH_HANDS_RAISED;
    } else if (isRightHandRaised) {
        return ACTION_TYPE.RIGHT_HAND_RAISED;
    } else if (isLeftHandRaised) {
        return ACTION_TYPE.LEFT_HAND_RAISED;
    } else if (isJumping) {
        return ACTION_TYPE.JUMPING;
    } else {
        return ACTION_TYPE.STANDING;
    }
}

/**
 * 识别多人场景中每个人的动作
 *
 * @param {Array} multiLandmarks - MediaPipe 返回的多人的关键点数组
 * @param {Object} options - 同 recognizeAction 的 options
 * @returns {Array} - 每个人识别结果的数组 [{landmarks, action}, ...]
 *
 * @example
 * const results = results.multiPoseLandmarks;
 * const actions = recognizeMultiPlayerAction(results);
 * actions.forEach((item, index) => {
 *     console.log(`玩家${index + 1}:`, item.action);
 * });
 */
function recognizeMultiPlayerAction(multiLandmarks, options = {}) {
    if (!multiLandmarks || !Array.isArray(multiLandmarks)) {
        return [];
    }

    return multiLandmarks.map(landmarks => ({
        landmarks: landmarks,
        action: recognizeAction(landmarks, options)
    }));
}

/**
 * 创建姿态动作识别器类（适用于需要在类中使用的场景）
 *
 * @class
 * @example
 * class MyGame {
 *     constructor() {
 *         this.recognizer = new PoseActionRecognizer();
 *     }
 *
 *     onResults(results) {
 *         if (results.poseLandmarks) {
 *             const action = this.recognizer.recognize(results.poseLandmarks);
 *             console.log(action);
 *         }
 *     }
 * }
 */
class PoseActionRecognizer {
    /**
     * @param {Object} options - 配置选项，同 recognizeAction
     */
    constructor(options = {}) {
        this.options = options;
    }

    /**
     * 识别动作
     * @param {Array} landmarks - 关键点数组
     * @returns {string} - 动作字符串
     */
    recognize(landmarks) {
        return recognizeAction(landmarks, this.options);
    }

    /**
     * 检查关键点是否有效
     * @param {Array} landmarks - 关键点数组
     * @returns {boolean}
     */
    isValid(landmarks) {
        return isValidLandmarks(landmarks);
    }

    /**
     * 更新配置
     * @param {Object} newOptions - 新配置
     */
    setOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }
}

// ==================== 调用示例 ====================
// 本模块的使用方式：页面负责获取 landmarks 数据，调用本模块函数进行动作识别
// 页面获取 landmarks 的方式由页面自己决定（可以来自 MediaPipe 回调、录制的视频、API 等）

/**
 * 示例1: 直接传入关键点数据进行动作识别
 *
 * // landmarks 数据来自 MediaPipe Pose 的检测结果
 * const landmarks = results.poseLandmarks;  // 单人模式
 *
 * // 调用识别函数，直接返回动作结果
 * const action = recognizeAction(landmarks);
 * // 返回值: "举起右手" | "举起左手" | "举起双手" | "张开双手" | "跳起来" | "站立" | "未检测到完整姿态"
 *
 * // 页面根据自己的业务逻辑处理识别结果
 * if (action === '举起右手') {
 *     // 处理右手举起的逻辑
 * }
 */

/**
 * 示例2: 多人模式 - 识别多人动作
 *
 * // landmarks 数据来自 MediaPipe Pose 的检测结果
 * const multiLandmarks = results.multiPoseLandmarks;  // 多人模式，数组
 *
 * // 调用识别函数，传入多人关键点数组
 * const actions = recognizeMultiPlayerAction(multiLandmarks);
 * // 返回值: [{landmarks, action}, ...] 每个人的识别结果
 *
 * // 页面遍历处理每个人的动作
 * actions.forEach((item, index) => {
 *     console.log(`玩家${index + 1}:`, item.action);
 * });
 */

/**
 * 示例3: 自定义配置选项
 *
 * const action = recognizeAction(landmarks, {
 *     useUpperBodyJumpDetection: false,  // 使用下半身（髋部）判断跳跃
 *     armRaisedThresholdRatio: 0.3,      // 抬手阈值比例
 *     jumpUpperThreshold: 0.25,           // 上半身跳跃阈值（值越小要求跳得越高）
 *     jumpLowerThreshold: 0.3,           // 下半身跳跃阈值
 *     handsOnHeadThreshold: 0.3         // 双手抱头距离阈值
 * });
 */

/**
 * 示例4: 关键点有效性检查（可选使用）
 *
 * if (isValidLandmarks(landmarks)) {
 *     const action = recognizeAction(landmarks);
 * } else {
 *     console.log('关键点不完整，无法识别');
 * }
 */

/**
 * 示例5: 使用动作类型常量进行比较（推荐方式）
 *
 * const action = recognizeAction(landmarks);
 *
 * switch (action) {
 *     case ACTION_TYPE.RIGHT_HAND_RAISED:
 *         // 处理右手举起
 *         break;
 *     case ACTION_TYPE.LEFT_HAND_RAISED:
 *         // 处理左手举起
 *         break;
 *     case ACTION_TYPE.BOTH_HANDS_RAISED:
 *         // 处理双手举起
 *         break;
 *     case ACTION_TYPE.JUMPING:
 *         // 处理跳跃
 *         break;
 *     default:
 *         // 处理其他状态
 *         break;
 * }
 */
