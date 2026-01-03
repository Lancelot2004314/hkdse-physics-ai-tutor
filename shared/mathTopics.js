/**
 * HKDSE Mathematics Curriculum Structure
 * Based on official HKDSE Mathematics syllabus
 * Includes Compulsory Part and Extended Parts (M1, M2)
 */

export const MATH_TOPICS = {
  // ========== Compulsory Part 必修部分 ==========
  
  number_algebra: {
    id: 'number_algebra',
    name: '數與代數',
    nameEn: 'Number and Algebra',
    subtopics: [
      { id: 'num_1', name: '數系統', nameEn: 'Number Systems' },
      { id: 'num_2', name: '指數與對數', nameEn: 'Indices and Logarithms' },
      { id: 'alg_1', name: '代數式運算', nameEn: 'Algebraic Expressions' },
      { id: 'alg_2', name: '因式分解', nameEn: 'Factorization' },
      { id: 'alg_3', name: '方程', nameEn: 'Equations' },
      { id: 'alg_4', name: '不等式', nameEn: 'Inequalities' },
      { id: 'alg_5', name: '恆等式', nameEn: 'Identities' },
      { id: 'alg_6', name: '變分', nameEn: 'Variations' },
      { id: 'alg_7', name: '續方程', nameEn: 'More about Equations' },
      { id: 'alg_8', name: '續不等式', nameEn: 'More about Inequalities' },
    ]
  },

  measures_shape_space: {
    id: 'measures_shape_space',
    name: '度量、圖形與空間',
    nameEn: 'Measures, Shape and Space',
    subtopics: [
      { id: 'mss_1', name: '長度、面積和體積', nameEn: 'Length, Area and Volume' },
      { id: 'mss_2', name: '畢氏定理', nameEn: 'Pythagoras Theorem' },
      { id: 'mss_3', name: '直線與平面的幾何', nameEn: 'Geometry of Lines and Planes' },
      { id: 'mss_4', name: '三角形的全等和相似', nameEn: 'Congruence and Similarity of Triangles' },
      { id: 'mss_5', name: '多邊形', nameEn: 'Polygons' },
      { id: 'mss_6', name: '圓的基本性質', nameEn: 'Basic Properties of Circles' },
      { id: 'mss_7', name: '坐標幾何', nameEn: 'Coordinate Geometry' },
      { id: 'mss_8', name: '續坐標幾何', nameEn: 'More about Coordinate Geometry' },
      { id: 'mss_9', name: '變換與對稱', nameEn: 'Transformation and Symmetry' },
      { id: 'mss_10', name: '續圓的性質', nameEn: 'More about Circles' },
    ]
  },

  trigonometry: {
    id: 'trigonometry',
    name: '三角學',
    nameEn: 'Trigonometry',
    subtopics: [
      { id: 'trig_1', name: '三角比', nameEn: 'Trigonometric Ratios' },
      { id: 'trig_2', name: '三角恆等式', nameEn: 'Trigonometric Identities' },
      { id: 'trig_3', name: '正弦定理和餘弦定理', nameEn: 'Sine and Cosine Formulae' },
      { id: 'trig_4', name: '續三角學', nameEn: 'More about Trigonometry' },
    ]
  },

  data_handling: {
    id: 'data_handling',
    name: '數據處理',
    nameEn: 'Data Handling',
    subtopics: [
      { id: 'data_1', name: '數據的組織和展示', nameEn: 'Organization and Presentation of Data' },
      { id: 'data_2', name: '數據的度量', nameEn: 'Measures of Data' },
      { id: 'data_3', name: '概率', nameEn: 'Probability' },
      { id: 'data_4', name: '續概率', nameEn: 'More about Probability' },
    ]
  },

  // ========== Extended Part Module 1 (M1) 延伸部分單元一 ==========
  
  m1_calculus: {
    id: 'm1_calculus',
    name: 'M1 微積分',
    nameEn: 'M1 Calculus',
    subtopics: [
      { id: 'm1_calc_1', name: '二項式定理', nameEn: 'Binomial Theorem' },
      { id: 'm1_calc_2', name: '數列與級數', nameEn: 'Sequences and Series' },
      { id: 'm1_calc_3', name: '極限與導數', nameEn: 'Limits and Derivatives' },
      { id: 'm1_calc_4', name: '微分法則', nameEn: 'Differentiation Rules' },
      { id: 'm1_calc_5', name: '微分的應用', nameEn: 'Applications of Differentiation' },
      { id: 'm1_calc_6', name: '積分', nameEn: 'Integration' },
      { id: 'm1_calc_7', name: '積分的應用', nameEn: 'Applications of Integration' },
      { id: 'm1_calc_8', name: '微分方程', nameEn: 'Differential Equations' },
    ]
  },

  m1_statistics: {
    id: 'm1_statistics',
    name: 'M1 統計',
    nameEn: 'M1 Statistics',
    subtopics: [
      { id: 'm1_stat_1', name: '抽樣與抽樣分佈', nameEn: 'Sampling and Sampling Distributions' },
      { id: 'm1_stat_2', name: '估計', nameEn: 'Estimation' },
      { id: 'm1_stat_3', name: '假設檢定', nameEn: 'Hypothesis Testing' },
      { id: 'm1_stat_4', name: '相關與回歸', nameEn: 'Correlation and Regression' },
      { id: 'm1_stat_5', name: '卡方檢定', nameEn: 'Chi-squared Test' },
    ]
  },

  // ========== Extended Part Module 2 (M2) 延伸部分單元二 ==========
  
  m2_algebra: {
    id: 'm2_algebra',
    name: 'M2 代數與微積分',
    nameEn: 'M2 Algebra and Calculus',
    subtopics: [
      { id: 'm2_alg_1', name: '多項式的因式分解', nameEn: 'Factorization of Polynomials' },
      { id: 'm2_alg_2', name: '續方程', nameEn: 'More about Equations' },
      { id: 'm2_alg_3', name: '數學歸納法', nameEn: 'Mathematical Induction' },
      { id: 'm2_alg_4', name: '二項式定理', nameEn: 'Binomial Theorem' },
      { id: 'm2_calc_1', name: '指數函數與對數函數', nameEn: 'Exponential and Logarithmic Functions' },
      { id: 'm2_calc_2', name: '極限與導數', nameEn: 'Limits and Derivatives' },
      { id: 'm2_calc_3', name: '微分法則', nameEn: 'Differentiation Rules' },
      { id: 'm2_calc_4', name: '微分的應用', nameEn: 'Applications of Differentiation' },
      { id: 'm2_calc_5', name: '積分', nameEn: 'Integration' },
      { id: 'm2_calc_6', name: '積分的應用', nameEn: 'Applications of Integration' },
      { id: 'm2_calc_7', name: '微分方程', nameEn: 'Differential Equations' },
    ]
  },

  m2_geometry: {
    id: 'm2_geometry',
    name: 'M2 幾何與向量',
    nameEn: 'M2 Geometry and Vectors',
    subtopics: [
      { id: 'm2_geo_1', name: '向量的基本概念', nameEn: 'Basic Concepts of Vectors' },
      { id: 'm2_geo_2', name: '向量運算', nameEn: 'Vector Operations' },
      { id: 'm2_geo_3', name: '直線的向量方程', nameEn: 'Vector Equations of Lines' },
      { id: 'm2_geo_4', name: '平面的向量方程', nameEn: 'Vector Equations of Planes' },
      { id: 'm2_geo_5', name: '純量積', nameEn: 'Scalar Product' },
      { id: 'm2_geo_6', name: '向量積', nameEn: 'Vector Product' },
      { id: 'm2_geo_7', name: '三維空間的幾何', nameEn: 'Geometry in 3D Space' },
    ]
  },

  m2_complex: {
    id: 'm2_complex',
    name: 'M2 複數',
    nameEn: 'M2 Complex Numbers',
    subtopics: [
      { id: 'm2_comp_1', name: '複數的基本概念', nameEn: 'Basic Concepts of Complex Numbers' },
      { id: 'm2_comp_2', name: '複數的運算', nameEn: 'Operations on Complex Numbers' },
      { id: 'm2_comp_3', name: '複數的極式', nameEn: 'Polar Form of Complex Numbers' },
      { id: 'm2_comp_4', name: '棣美弗定理', nameEn: 'De Moivre\'s Theorem' },
      { id: 'm2_comp_5', name: '複數方程', nameEn: 'Equations with Complex Numbers' },
      { id: 'm2_comp_6', name: '複數的軌跡', nameEn: 'Loci in Complex Plane' },
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

