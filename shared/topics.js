// HKDSE Physics Topics Structure
// Based on official HKDSE Physics curriculum

export const PHYSICS_TOPICS = {
  heat_gas: {
    id: 'heat_gas',
    name: '熱與氣體',
    nameEn: 'Heat and Gases',
    color: '#ef4444',
    subtopics: [
      { id: 'heat_1', name: '溫度、熱及內能', nameEn: 'Temperature, Heat and Internal Energy' },
      { id: 'heat_2', name: '傳導、對流、輻射', nameEn: 'Conduction, Convection and Radiation' },
      { id: 'heat_3', name: '物態轉變與潛熱', nameEn: 'Change of State and Latent Heat' },
      { id: 'heat_4', name: '氣體定律與動理學理論', nameEn: 'Gas Laws and Kinetic Theory' }
    ]
  },
  mechanics: {
    id: 'mechanics',
    name: '力和運動',
    nameEn: 'Force and Motion',
    color: '#3b82f6',
    subtopics: [
      { id: 'mech_1', name: '位移與運動學', nameEn: 'Displacement and Kinematics' },
      { id: 'mech_2', name: '牛頓定律', nameEn: "Newton's Laws" },
      { id: 'mech_3', name: '拋體運動', nameEn: 'Projectile Motion' },
      { id: 'mech_4', name: '作功、能量和功率', nameEn: 'Work, Energy and Power' },
      { id: 'mech_5', name: '動量', nameEn: 'Momentum' },
      { id: 'mech_6', name: '圓周運動與重力', nameEn: 'Circular Motion and Gravitation' }
    ]
  },
  waves: {
    id: 'waves',
    name: '波動',
    nameEn: 'Waves',
    color: '#8b5cf6',
    subtopics: [
      { id: 'wave_1', name: '波的本質和特性', nameEn: 'Nature and Properties of Waves' },
      { id: 'wave_2', name: '光的反射、折射、繞射與透鏡', nameEn: 'Reflection, Refraction, Diffraction and Lenses' },
      { id: 'wave_3', name: '聲波', nameEn: 'Sound Waves' }
    ]
  },
  electricity: {
    id: 'electricity',
    name: '電和磁',
    nameEn: 'Electricity and Magnetism',
    color: '#f59e0b',
    subtopics: [
      { id: 'elec_1', name: '靜電學', nameEn: 'Electrostatics' },
      { id: 'elec_2', name: '電路', nameEn: 'Electric Circuits' },
      { id: 'elec_3', name: '電磁感應', nameEn: 'Electromagnetic Induction' },
      { id: 'elec_4', name: '交流電', nameEn: 'Alternating Current' }
    ]
  },
  radioactivity: {
    id: 'radioactivity',
    name: '放射現象和核能',
    nameEn: 'Radioactivity and Nuclear Energy',
    color: '#22c55e',
    subtopics: [
      { id: 'radio_1', name: '放射性衰變', nameEn: 'Radioactive Decay' },
      { id: 'radio_2', name: '核反應', nameEn: 'Nuclear Reactions' },
      { id: 'radio_3', name: '核能應用', nameEn: 'Applications of Nuclear Energy' }
    ]
  },
  astronomy: {
    id: 'astronomy',
    name: '天文學和航天科學',
    nameEn: 'Astronomy and Space Science',
    color: '#06b6d4',
    subtopics: [
      { id: 'astro_1', name: '太陽系', nameEn: 'The Solar System' },
      { id: 'astro_2', name: '恆星', nameEn: 'Stars' },
      { id: 'astro_3', name: '宇宙學', nameEn: 'Cosmology' }
    ]
  }
};

// Get all subtopic IDs
export function getAllSubtopicIds() {
  const ids = [];
  Object.values(PHYSICS_TOPICS).forEach(topic => {
    topic.subtopics.forEach(sub => ids.push(sub.id));
  });
  return ids;
}

// Get topic by subtopic ID
export function getTopicBySubtopicId(subtopicId) {
  for (const topic of Object.values(PHYSICS_TOPICS)) {
    const subtopic = topic.subtopics.find(s => s.id === subtopicId);
    if (subtopic) {
      return { topic, subtopic };
    }
  }
  return null;
}

// Get subtopic names for display
export function getSubtopicNames(subtopicIds, language = 'zh') {
  return subtopicIds.map(id => {
    const result = getTopicBySubtopicId(id);
    if (result) {
      return language === 'en' ? result.subtopic.nameEn : result.subtopic.name;
    }
    return id;
  });
}

// DSE Grade calculation
export function calculateGrade(percentage) {
  if (percentage >= 90) return '5**';
  if (percentage >= 80) return '5*';
  if (percentage >= 70) return '5';
  if (percentage >= 60) return '4';
  if (percentage >= 50) return '3';
  if (percentage >= 40) return '2';
  if (percentage >= 30) return '1';
  return 'U';
}

// Difficulty labels
export const DIFFICULTY_LABELS = {
  1: { zh: '非常簡單', en: 'Very Easy' },
  2: { zh: '簡單', en: 'Easy' },
  3: { zh: '中等', en: 'Medium' },
  4: { zh: '困難', en: 'Hard' },
  5: { zh: '非常困難', en: 'Very Hard' }
};


