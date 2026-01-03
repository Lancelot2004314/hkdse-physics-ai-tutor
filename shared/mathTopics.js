/**
 * HKDSE Mathematics Curriculum Structure
 * Based on official HKDSE Mathematics syllabus
 * Includes Compulsory Part and Extended Parts (M1, M2)
 * 
 * ID format: math_<category>_<number>
 * - math_na_* : Number and Algebra (數與代數)
 * - math_geo_* : Geometry (度量、圖形與空間)
 * - math_trig_* : Trigonometry (三角學)
 * - math_stat_* : Statistics (數據處理)
 * - math_m1_* : M1 Extended (微積分與統計)
 * - math_m2_* : M2 Extended (代數與微積分)
 */

export const MATH_TOPICS = {
    // ========== Compulsory Part 必修部分 ==========

    number_algebra: {
        id: 'number_algebra',
        name: '數與代數',
        nameEn: 'Number and Algebra',
        subtopics: [
            { id: 'math_na_1', name: '指數定律', nameEn: 'Laws of Indices' },
            { id: 'math_na_2', name: '多項式', nameEn: 'Polynomials' },
            { id: 'math_na_3', name: '因式分解', nameEn: 'Factorization' },
            { id: 'math_na_4', name: '二次方程', nameEn: 'Quadratic Equations' },
            { id: 'math_na_5', name: '函數及其圖像', nameEn: 'Functions and Graphs' },
            { id: 'math_na_6', name: '指數函數與對數函數', nameEn: 'Exponential and Logarithmic Functions' },
            { id: 'math_na_7', name: '等差數列與等比數列', nameEn: 'Arithmetic and Geometric Sequences' },
            { id: 'math_na_8', name: '不等式', nameEn: 'Inequalities' },
            { id: 'math_na_9', name: '線性規劃', nameEn: 'Linear Programming' },
            { id: 'math_na_10', name: '變分', nameEn: 'Variations' },
        ]
    },

    geometry: {
        id: 'geometry',
        name: '度量、圖形與空間',
        nameEn: 'Measures, Shape and Space',
        subtopics: [
            { id: 'math_geo_1', name: '直線方程', nameEn: 'Equations of Straight Lines' },
            { id: 'math_geo_2', name: '圓的方程', nameEn: 'Equations of Circles' },
            { id: 'math_geo_3', name: '軌跡', nameEn: 'Locus' },
            { id: 'math_geo_4', name: '演繹幾何', nameEn: 'Deductive Geometry' },
            { id: 'math_geo_5', name: '平面圖形的面積與周界', nameEn: 'Area and Perimeter of Plane Figures' },
            { id: 'math_geo_6', name: '立體圖形', nameEn: 'Solid Figures' },
            { id: 'math_geo_7', name: '三維圖形的體積與表面積', nameEn: 'Volume and Surface Area of 3D Figures' },
            { id: 'math_geo_8', name: '相似與全等', nameEn: 'Similarity and Congruence' },
        ]
    },

    trigonometry: {
        id: 'trigonometry',
        name: '三角學',
        nameEn: 'Trigonometry',
        subtopics: [
            { id: 'math_trig_1', name: '三角比', nameEn: 'Trigonometric Ratios' },
            { id: 'math_trig_2', name: '三角函數的圖像', nameEn: 'Graphs of Trigonometric Functions' },
            { id: 'math_trig_3', name: '三角恆等式', nameEn: 'Trigonometric Identities' },
            { id: 'math_trig_4', name: '解三角形', nameEn: 'Solving Triangles' },
            { id: 'math_trig_5', name: '弧度制與扇形', nameEn: 'Radian Measure and Sectors' },
            { id: 'math_trig_6', name: '二維與三維問題', nameEn: '2D and 3D Problems' },
        ]
    },

    statistics: {
        id: 'statistics',
        name: '數據處理',
        nameEn: 'Data Handling',
        subtopics: [
            { id: 'math_stat_1', name: '統計的表達方式', nameEn: 'Presentation of Statistics' },
            { id: 'math_stat_2', name: '集中趨勢的量度', nameEn: 'Measures of Central Tendency' },
            { id: 'math_stat_3', name: '離差的量度', nameEn: 'Measures of Dispersion' },
            { id: 'math_stat_4', name: '概率', nameEn: 'Probability' },
            { id: 'math_stat_5', name: '排列與組合', nameEn: 'Permutations and Combinations' },
        ]
    },

    // ========== Extended Part Module 1 (M1) 延伸部分單元一 ==========

    calculus_m1: {
        id: 'calculus_m1',
        name: 'M1 微積分與統計',
        nameEn: 'M1 Calculus and Statistics',
        subtopics: [
            { id: 'math_m1_1', name: '二項式展開', nameEn: 'Binomial Expansion' },
            { id: 'math_m1_2', name: '極限與微分', nameEn: 'Limits and Differentiation' },
            { id: 'math_m1_3', name: '微分的應用', nameEn: 'Applications of Differentiation' },
            { id: 'math_m1_4', name: '積分', nameEn: 'Integration' },
            { id: 'math_m1_5', name: '定積分的應用', nameEn: 'Applications of Definite Integration' },
            { id: 'math_m1_6', name: '離散隨機變量', nameEn: 'Discrete Random Variables' },
            { id: 'math_m1_7', name: '二項分佈', nameEn: 'Binomial Distribution' },
            { id: 'math_m1_8', name: '正態分佈', nameEn: 'Normal Distribution' },
            { id: 'math_m1_9', name: '抽樣分佈與估計', nameEn: 'Sampling Distribution and Estimation' },
        ]
    },

    // ========== Extended Part Module 2 (M2) 延伸部分單元二 ==========

    algebra_m2: {
        id: 'algebra_m2',
        name: 'M2 代數與微積分',
        nameEn: 'M2 Algebra and Calculus',
        subtopics: [
            { id: 'math_m2_1', name: '數學歸納法', nameEn: 'Mathematical Induction' },
            { id: 'math_m2_2', name: '二項式定理', nameEn: 'Binomial Theorem' },
            { id: 'math_m2_3', name: '三角學進階', nameEn: 'More about Trigonometry' },
            { id: 'math_m2_4', name: 'e 和自然對數', nameEn: 'e and Natural Logarithm' },
            { id: 'math_m2_5', name: '極限', nameEn: 'Limits' },
            { id: 'math_m2_6', name: '微分法', nameEn: 'Differentiation' },
            { id: 'math_m2_7', name: '微分的應用', nameEn: 'Applications of Differentiation' },
            { id: 'math_m2_8', name: '不定積分', nameEn: 'Indefinite Integration' },
            { id: 'math_m2_9', name: '定積分', nameEn: 'Definite Integration' },
            { id: 'math_m2_10', name: '定積分的應用', nameEn: 'Applications of Definite Integration' },
            { id: 'math_m2_11', name: '矩陣', nameEn: 'Matrices' },
            { id: 'math_m2_12', name: '線性方程組', nameEn: 'Systems of Linear Equations' },
            { id: 'math_m2_13', name: '向量', nameEn: 'Vectors' },
        ]
    },
};

/**
 * Get subtopic names by IDs for display in prompts
 * @param {string[]} subtopicIds - Array of subtopic IDs
 * @param {string} lang - Language ('zh' or 'en')
 * @returns {string[]} Array of subtopic names
 */
export function getMathSubtopicNames(subtopicIds, lang = 'zh') {
    const names = [];
    for (const topicKey in MATH_TOPICS) {
        const topic = MATH_TOPICS[topicKey];
        for (const subtopic of topic.subtopics || []) {
            if (subtopicIds.includes(subtopic.id)) {
                names.push(lang === 'en' ? subtopic.nameEn : subtopic.name);
            }
        }
    }
    return names;
}

/**
 * Get all subtopic IDs as a flat array
 * @returns {string[]} Array of all subtopic IDs
 */
export function getAllMathSubtopicIds() {
    const ids = [];
    for (const topicKey in MATH_TOPICS) {
        const topic = MATH_TOPICS[topicKey];
        for (const subtopic of topic.subtopics || []) {
            ids.push(subtopic.id);
        }
    }
    return ids;
}

/**
 * Get topic name by subtopic ID
 * @param {string} subtopicId - Subtopic ID
 * @param {string} lang - Language ('zh' or 'en')
 * @returns {string} Topic name
 */
export function getMathTopicNameBySubtopicId(subtopicId, lang = 'zh') {
    for (const topicKey in MATH_TOPICS) {
        const topic = MATH_TOPICS[topicKey];
        for (const subtopic of topic.subtopics || []) {
            if (subtopic.id === subtopicId) {
                return lang === 'en' ? topic.nameEn : topic.name;
            }
        }
    }
    return '';
}

/**
 * Get subtopic info by ID
 * @param {string} subtopicId - Subtopic ID
 * @returns {object|null} Subtopic info { id, name, nameEn, parentTopic }
 */
export function getMathSubtopicById(subtopicId) {
    for (const topicKey in MATH_TOPICS) {
        const topic = MATH_TOPICS[topicKey];
        for (const subtopic of topic.subtopics || []) {
            if (subtopic.id === subtopicId) {
                return {
                    ...subtopic,
                    parentTopic: topic.name,
                    parentTopicEn: topic.nameEn,
                };
            }
        }
    }
    return null;
}
