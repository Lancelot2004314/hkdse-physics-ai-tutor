/**
 * Detailed Skill Tree Configuration for DSE Physics
 * Based on HKEAA DSE Physics Curriculum and Assessment Guide
 * 
 * ~60 skill nodes organized by:
 * - 5 Compulsory Units
 * - 2 Elective Options
 */

// Unit definitions
export const SKILL_TREE_UNITS = [
  {
    id: 'unit-1',
    name: 'Heat and Gases',
    name_zh: '熱和氣體',
    description: 'Temperature, heat transfer, and gas laws',
    icon: 'fire',
    color: '#ef4444',
    isElective: false,
  },
  {
    id: 'unit-2',
    name: 'Force and Motion',
    name_zh: '力學和運動',
    description: 'Kinematics, dynamics, and energy',
    icon: 'rocket',
    color: '#3b82f6',
    isElective: false,
  },
  {
    id: 'unit-3',
    name: 'Wave Motion',
    name_zh: '波動',
    description: 'Properties of waves, light, and sound',
    icon: 'wave-square',
    color: '#8b5cf6',
    isElective: false,
  },
  {
    id: 'unit-4',
    name: 'Electricity and Magnetism',
    name_zh: '電和磁',
    description: 'Electrostatics, circuits, and electromagnetism',
    icon: 'bolt',
    color: '#f59e0b',
    isElective: false,
  },
  {
    id: 'unit-5',
    name: 'Radioactivity and Nuclear Energy',
    name_zh: '放射現象和核能',
    description: 'Radiation, atomic structure, and nuclear reactions',
    icon: 'radiation',
    color: '#22c55e',
    isElective: false,
  },
  {
    id: 'elective-astro',
    name: 'Astronomy and Space Science',
    name_zh: '天文學和航天科學',
    description: 'Solar system, stars, and cosmology',
    icon: 'star',
    color: '#06b6d4',
    isElective: true,
  },
  {
    id: 'elective-atomic',
    name: 'Atomic World',
    name_zh: '原子世界',
    description: 'Atomic models, photoelectric effect, and spectra',
    icon: 'atom',
    color: '#ec4899',
    isElective: true,
  },
];

// Detailed skill nodes (~60 nodes)
export const SKILL_TREE_NODES = [
  // ===== Unit 1: Heat and Gases (10 nodes) =====
  // 1.1 Temperature, Heat and Internal Energy
  { id: 'heat-1a-1', unitId: 'unit-1', name: 'Temperature Scales', name_zh: '溫標', description: 'Celsius and Kelvin scales, absolute zero', prerequisites: [], order: 1, icon: 'thermometer', topicKey: 'heat_1' },
  { id: 'heat-1a-2', unitId: 'unit-1', name: 'Heat and Internal Energy', name_zh: '熱量與內能', description: 'Difference between heat and internal energy', prerequisites: ['heat-1a-1'], order: 2, icon: 'fire-alt', topicKey: 'heat_1' },
  { id: 'heat-1a-3', unitId: 'unit-1', name: 'Specific Heat Capacity', name_zh: '比熱容量', description: 'Q = mcΔT calculations', prerequisites: ['heat-1a-2'], order: 3, icon: 'calculator', topicKey: 'heat_1' },
  
  // 1.2 Transfer Processes
  { id: 'heat-1b-1', unitId: 'unit-1', name: 'Conduction', name_zh: '傳導', description: 'Heat conduction in solids', prerequisites: ['heat-1a-3'], order: 4, icon: 'grip-lines', topicKey: 'heat_2' },
  { id: 'heat-1b-2', unitId: 'unit-1', name: 'Convection', name_zh: '對流', description: 'Heat transfer in fluids', prerequisites: ['heat-1b-1'], order: 5, icon: 'water', topicKey: 'heat_2' },
  { id: 'heat-1b-3', unitId: 'unit-1', name: 'Radiation', name_zh: '輻射', description: 'Infrared radiation and emission', prerequisites: ['heat-1b-2'], order: 6, icon: 'sun', topicKey: 'heat_2' },
  
  // 1.3 Change of State
  { id: 'heat-1c-1', unitId: 'unit-1', name: 'States of Matter', name_zh: '物質狀態', description: 'Solid, liquid, gas and phase changes', prerequisites: ['heat-1b-3'], order: 7, icon: 'snowflake', topicKey: 'heat_3' },
  { id: 'heat-1c-2', unitId: 'unit-1', name: 'Latent Heat', name_zh: '潛熱', description: 'Latent heat of fusion and vaporization', prerequisites: ['heat-1c-1'], order: 8, icon: 'tint', topicKey: 'heat_3' },
  
  // 1.4 Gases
  { id: 'heat-1d-1', unitId: 'unit-1', name: 'Gas Laws', name_zh: '氣體定律', description: 'Boyle, Charles, and Pressure Laws', prerequisites: ['heat-1c-2'], order: 9, icon: 'cloud', topicKey: 'heat_4' },
  { id: 'heat-1d-2', unitId: 'unit-1', name: 'Ideal Gas Equation', name_zh: '理想氣體方程', description: 'pV = nRT calculations', prerequisites: ['heat-1d-1'], order: 10, icon: 'superscript', topicKey: 'heat_4' },
  
  // ===== Unit 2: Force and Motion (14 nodes) =====
  // 2.1 Position and Movement
  { id: 'motion-2a-1', unitId: 'unit-2', name: 'Distance and Displacement', name_zh: '距離與位移', description: 'Scalars vs vectors', prerequisites: [], order: 11, icon: 'route', topicKey: 'mech_1' },
  { id: 'motion-2a-2', unitId: 'unit-2', name: 'Speed and Velocity', name_zh: '速率與速度', description: 'Average and instantaneous velocity', prerequisites: ['motion-2a-1'], order: 12, icon: 'tachometer-alt', topicKey: 'mech_1' },
  { id: 'motion-2a-3', unitId: 'unit-2', name: 'Acceleration', name_zh: '加速度', description: 'Uniform acceleration, s-t and v-t graphs', prerequisites: ['motion-2a-2'], order: 13, icon: 'chart-line', topicKey: 'mech_1' },
  { id: 'motion-2a-4', unitId: 'unit-2', name: 'Equations of Motion', name_zh: '運動方程式', description: 'v = u + at, s = ut + ½at²', prerequisites: ['motion-2a-3'], order: 14, icon: 'square-root-alt', topicKey: 'mech_1' },
  
  // 2.2 Force and Motion
  { id: 'motion-2b-1', unitId: 'unit-2', name: 'Types of Forces', name_zh: '力的種類', description: 'Weight, friction, tension, normal force', prerequisites: ['motion-2a-4'], order: 15, icon: 'hand-rock', topicKey: 'mech_2' },
  { id: 'motion-2b-2', unitId: 'unit-2', name: "Newton's First Law", name_zh: '牛頓第一定律', description: 'Inertia and equilibrium', prerequisites: ['motion-2b-1'], order: 16, icon: 'balance-scale', topicKey: 'mech_2' },
  { id: 'motion-2b-3', unitId: 'unit-2', name: "Newton's Second Law", name_zh: '牛頓第二定律', description: 'F = ma calculations', prerequisites: ['motion-2b-2'], order: 17, icon: 'arrows-alt', topicKey: 'mech_2' },
  { id: 'motion-2b-4', unitId: 'unit-2', name: "Newton's Third Law", name_zh: '牛頓第三定律', description: 'Action-reaction pairs', prerequisites: ['motion-2b-3'], order: 18, icon: 'exchange-alt', topicKey: 'mech_2' },
  
  // 2.3 Projectile Motion
  { id: 'motion-2c-1', unitId: 'unit-2', name: 'Projectile Motion Basics', name_zh: '拋體運動基礎', description: 'Independence of horizontal and vertical motion', prerequisites: ['motion-2b-4'], order: 19, icon: 'basketball-ball', topicKey: 'mech_3' },
  { id: 'motion-2c-2', unitId: 'unit-2', name: 'Projectile Calculations', name_zh: '拋體運動計算', description: 'Range, maximum height, time of flight', prerequisites: ['motion-2c-1'], order: 20, icon: 'calculator', topicKey: 'mech_3' },
  
  // 2.4 Work, Energy and Power
  { id: 'motion-2d-1', unitId: 'unit-2', name: 'Work Done', name_zh: '作功', description: 'W = Fs cos θ', prerequisites: ['motion-2c-2'], order: 21, icon: 'hammer', topicKey: 'mech_4' },
  { id: 'motion-2d-2', unitId: 'unit-2', name: 'Kinetic and Potential Energy', name_zh: '動能與勢能', description: 'KE = ½mv², PE = mgh', prerequisites: ['motion-2d-1'], order: 22, icon: 'battery-full', topicKey: 'mech_4' },
  { id: 'motion-2d-3', unitId: 'unit-2', name: 'Conservation of Energy', name_zh: '能量守恆', description: 'Energy transformations', prerequisites: ['motion-2d-2'], order: 23, icon: 'sync-alt', topicKey: 'mech_4' },
  { id: 'motion-2d-4', unitId: 'unit-2', name: 'Power', name_zh: '功率', description: 'P = W/t = Fv', prerequisites: ['motion-2d-3'], order: 24, icon: 'bolt', topicKey: 'mech_4' },
  
  // 2.5 Momentum
  { id: 'motion-2e-1', unitId: 'unit-2', name: 'Momentum', name_zh: '動量', description: 'p = mv', prerequisites: ['motion-2d-4'], order: 25, icon: 'truck-moving', topicKey: 'mech_5' },
  { id: 'motion-2e-2', unitId: 'unit-2', name: 'Impulse', name_zh: '衝量', description: 'J = Ft = Δp', prerequisites: ['motion-2e-1'], order: 26, icon: 'fist-raised', topicKey: 'mech_5' },
  { id: 'motion-2e-3', unitId: 'unit-2', name: 'Conservation of Momentum', name_zh: '動量守恆', description: 'Collisions and explosions', prerequisites: ['motion-2e-2'], order: 27, icon: 'random', topicKey: 'mech_5' },
  
  // 2.6 Circular Motion
  { id: 'motion-2f-1', unitId: 'unit-2', name: 'Circular Motion', name_zh: '圓周運動', description: 'Centripetal acceleration and force', prerequisites: ['motion-2e-3'], order: 28, icon: 'circle-notch', topicKey: 'mech_6' },
  
  // 2.7 Gravitation
  { id: 'motion-2g-1', unitId: 'unit-2', name: 'Gravitational Field', name_zh: '重力場', description: "Newton's law of gravitation", prerequisites: ['motion-2f-1'], order: 29, icon: 'globe', topicKey: 'mech_6' },
  
  // ===== Unit 3: Wave Motion (10 nodes) =====
  // 3.1 Nature and Properties of Waves
  { id: 'wave-3a-1', unitId: 'unit-3', name: 'Wave Properties', name_zh: '波的特性', description: 'Amplitude, frequency, wavelength, period', prerequisites: [], order: 30, icon: 'wave-square', topicKey: 'wave_1' },
  { id: 'wave-3a-2', unitId: 'unit-3', name: 'Transverse and Longitudinal', name_zh: '橫波與縱波', description: 'Types of waves', prerequisites: ['wave-3a-1'], order: 31, icon: 'arrows-alt-h', topicKey: 'wave_1' },
  { id: 'wave-3a-3', unitId: 'unit-3', name: 'Wave Equation', name_zh: '波動方程', description: 'v = fλ', prerequisites: ['wave-3a-2'], order: 32, icon: 'superscript', topicKey: 'wave_1' },
  { id: 'wave-3a-4', unitId: 'unit-3', name: 'Wave Phenomena', name_zh: '波動現象', description: 'Reflection, refraction, diffraction', prerequisites: ['wave-3a-3'], order: 33, icon: 'project-diagram', topicKey: 'wave_1' },
  
  // 3.2 Light
  { id: 'wave-3b-1', unitId: 'unit-3', name: 'Reflection of Light', name_zh: '光的反射', description: 'Laws of reflection, plane mirrors', prerequisites: ['wave-3a-4'], order: 34, icon: 'lightbulb', topicKey: 'wave_2' },
  { id: 'wave-3b-2', unitId: 'unit-3', name: 'Refraction of Light', name_zh: '光的折射', description: "Snell's law, total internal reflection", prerequisites: ['wave-3b-1'], order: 35, icon: 'glass-martini', topicKey: 'wave_2' },
  { id: 'wave-3b-3', unitId: 'unit-3', name: 'Lenses', name_zh: '透鏡', description: 'Converging and diverging lenses', prerequisites: ['wave-3b-2'], order: 36, icon: 'search', topicKey: 'wave_2' },
  
  // 3.3 Sound
  { id: 'wave-3c-1', unitId: 'unit-3', name: 'Sound Waves', name_zh: '聲波', description: 'Production and propagation of sound', prerequisites: ['wave-3b-3'], order: 37, icon: 'volume-up', topicKey: 'wave_3' },
  { id: 'wave-3c-2', unitId: 'unit-3', name: 'Sound Properties', name_zh: '聲音特性', description: 'Pitch, loudness, quality', prerequisites: ['wave-3c-1'], order: 38, icon: 'music', topicKey: 'wave_3' },
  { id: 'wave-3c-3', unitId: 'unit-3', name: 'Resonance', name_zh: '共振', description: 'Stationary waves and resonance', prerequisites: ['wave-3c-2'], order: 39, icon: 'guitar', topicKey: 'wave_3' },
  
  // ===== Unit 4: Electricity and Magnetism (12 nodes) =====
  // 4.1 Electrostatics
  { id: 'em-4a-1', unitId: 'unit-4', name: 'Electric Charge', name_zh: '電荷', description: 'Charging by friction and induction', prerequisites: [], order: 40, icon: 'charging-station', topicKey: 'elec_1' },
  { id: 'em-4a-2', unitId: 'unit-4', name: 'Electric Field', name_zh: '電場', description: 'Field lines and field strength', prerequisites: ['em-4a-1'], order: 41, icon: 'broadcast-tower', topicKey: 'elec_1' },
  { id: 'em-4a-3', unitId: 'unit-4', name: 'Electric Potential', name_zh: '電勢', description: 'Potential difference and work done', prerequisites: ['em-4a-2'], order: 42, icon: 'mountain', topicKey: 'elec_1' },
  
  // 4.2 Electric Circuits
  { id: 'em-4b-1', unitId: 'unit-4', name: 'Current and Resistance', name_zh: '電流與電阻', description: 'I = Q/t, Ohm\'s law', prerequisites: ['em-4a-3'], order: 43, icon: 'plug', topicKey: 'elec_2' },
  { id: 'em-4b-2', unitId: 'unit-4', name: 'Series and Parallel', name_zh: '串聯與並聯', description: 'Resistors in series and parallel', prerequisites: ['em-4b-1'], order: 44, icon: 'project-diagram', topicKey: 'elec_2' },
  { id: 'em-4b-3', unitId: 'unit-4', name: 'Electrical Power', name_zh: '電功率', description: 'P = IV = I²R = V²/R', prerequisites: ['em-4b-2'], order: 45, icon: 'bolt', topicKey: 'elec_2' },
  { id: 'em-4b-4', unitId: 'unit-4', name: 'Domestic Circuits', name_zh: '家居電路', description: 'Fuses, circuit breakers, earthing', prerequisites: ['em-4b-3'], order: 46, icon: 'home', topicKey: 'elec_2' },
  
  // 4.3 Electromagnetism
  { id: 'em-4c-1', unitId: 'unit-4', name: 'Magnetic Fields', name_zh: '磁場', description: 'Magnetic field of current', prerequisites: ['em-4b-4'], order: 47, icon: 'magnet', topicKey: 'elec_3' },
  { id: 'em-4c-2', unitId: 'unit-4', name: 'Motor Effect', name_zh: '電動機效應', description: 'Force on current-carrying conductor', prerequisites: ['em-4c-1'], order: 48, icon: 'cog', topicKey: 'elec_3' },
  { id: 'em-4c-3', unitId: 'unit-4', name: 'Electromagnetic Induction', name_zh: '電磁感應', description: "Faraday's law, Lenz's law", prerequisites: ['em-4c-2'], order: 49, icon: 'sync-alt', topicKey: 'elec_3' },
  { id: 'em-4c-4', unitId: 'unit-4', name: 'Transformers', name_zh: '變壓器', description: 'Step-up and step-down transformers', prerequisites: ['em-4c-3'], order: 50, icon: 'exchange-alt', topicKey: 'elec_3' },
  { id: 'em-4c-5', unitId: 'unit-4', name: 'AC Circuits', name_zh: '交流電路', description: 'AC voltage and current, RMS values', prerequisites: ['em-4c-4'], order: 51, icon: 'wave-square', topicKey: 'elec_4' },
  
  // ===== Unit 5: Radioactivity and Nuclear Energy (8 nodes) =====
  { id: 'nuclear-5a-1', unitId: 'unit-5', name: 'Atomic Structure', name_zh: '原子結構', description: 'Protons, neutrons, electrons', prerequisites: [], order: 52, icon: 'atom', topicKey: 'radio_1' },
  { id: 'nuclear-5a-2', unitId: 'unit-5', name: 'Radioactive Decay', name_zh: '放射性衰變', description: 'Alpha, beta, gamma radiation', prerequisites: ['nuclear-5a-1'], order: 53, icon: 'radiation-alt', topicKey: 'radio_1' },
  { id: 'nuclear-5a-3', unitId: 'unit-5', name: 'Half-life', name_zh: '半衰期', description: 'Decay curves and calculations', prerequisites: ['nuclear-5a-2'], order: 54, icon: 'hourglass-half', topicKey: 'radio_1' },
  { id: 'nuclear-5b-1', unitId: 'unit-5', name: 'Nuclear Equations', name_zh: '核方程式', description: 'Balancing nuclear equations', prerequisites: ['nuclear-5a-3'], order: 55, icon: 'balance-scale-right', topicKey: 'radio_2' },
  { id: 'nuclear-5b-2', unitId: 'unit-5', name: 'Mass-Energy Equivalence', name_zh: '質能等價', description: 'E = mc²', prerequisites: ['nuclear-5b-1'], order: 56, icon: 'infinity', topicKey: 'radio_2' },
  { id: 'nuclear-5c-1', unitId: 'unit-5', name: 'Nuclear Fission', name_zh: '核裂變', description: 'Chain reactions, nuclear reactors', prerequisites: ['nuclear-5b-2'], order: 57, icon: 'industry', topicKey: 'radio_3' },
  { id: 'nuclear-5c-2', unitId: 'unit-5', name: 'Nuclear Fusion', name_zh: '核聚變', description: 'Fusion in stars', prerequisites: ['nuclear-5c-1'], order: 58, icon: 'sun', topicKey: 'radio_3' },
  { id: 'nuclear-5c-3', unitId: 'unit-5', name: 'Applications of Radiation', name_zh: '輻射應用', description: 'Medical, industrial uses', prerequisites: ['nuclear-5c-2'], order: 59, icon: 'hospital', topicKey: 'radio_3' },
  
  // ===== Elective: Astronomy (6 nodes) =====
  { id: 'astro-1', unitId: 'elective-astro', name: 'Solar System', name_zh: '太陽系', description: 'Planets, moons, and orbits', prerequisites: [], order: 60, icon: 'globe-americas', topicKey: 'astro_1', isElective: true },
  { id: 'astro-2', unitId: 'elective-astro', name: "Kepler's Laws", name_zh: '開普勒定律', description: 'Planetary motion', prerequisites: ['astro-1'], order: 61, icon: 'redo', topicKey: 'astro_1', isElective: true },
  { id: 'astro-3', unitId: 'elective-astro', name: 'Stellar Properties', name_zh: '恆星性質', description: 'Luminosity, temperature, spectral classes', prerequisites: ['astro-2'], order: 62, icon: 'star', topicKey: 'astro_2', isElective: true },
  { id: 'astro-4', unitId: 'elective-astro', name: 'Stellar Evolution', name_zh: '恆星演化', description: 'Life cycle of stars', prerequisites: ['astro-3'], order: 63, icon: 'sun', topicKey: 'astro_2', isElective: true },
  { id: 'astro-5', unitId: 'elective-astro', name: 'Galaxies and Universe', name_zh: '星系與宇宙', description: 'Types of galaxies, Hubble\'s law', prerequisites: ['astro-4'], order: 64, icon: 'meteor', topicKey: 'astro_3', isElective: true },
  { id: 'astro-6', unitId: 'elective-astro', name: 'Cosmology', name_zh: '宇宙學', description: 'Big Bang, cosmic background radiation', prerequisites: ['astro-5'], order: 65, icon: 'expand', topicKey: 'astro_3', isElective: true },
  
  // ===== Elective: Atomic World (5 nodes) =====
  { id: 'atomic-1', unitId: 'elective-atomic', name: 'Rutherford Model', name_zh: '盧瑟福模型', description: 'Alpha scattering experiment', prerequisites: [], order: 66, icon: 'atom', topicKey: 'atomic_1', isElective: true },
  { id: 'atomic-2', unitId: 'elective-atomic', name: 'Bohr Model', name_zh: '玻爾模型', description: 'Energy levels and electron orbits', prerequisites: ['atomic-1'], order: 67, icon: 'circle-notch', topicKey: 'atomic_1', isElective: true },
  { id: 'atomic-3', unitId: 'elective-atomic', name: 'Photoelectric Effect', name_zh: '光電效應', description: 'Photons and work function', prerequisites: ['atomic-2'], order: 68, icon: 'lightbulb', topicKey: 'atomic_2', isElective: true },
  { id: 'atomic-4', unitId: 'elective-atomic', name: 'Atomic Spectra', name_zh: '原子光譜', description: 'Emission and absorption spectra', prerequisites: ['atomic-3'], order: 69, icon: 'rainbow', topicKey: 'atomic_2', isElective: true },
  { id: 'atomic-5', unitId: 'elective-atomic', name: 'Wave-Particle Duality', name_zh: '波粒二象性', description: 'de Broglie wavelength', prerequisites: ['atomic-4'], order: 70, icon: 'wave-square', topicKey: 'atomic_3', isElective: true },
];

// XP Configuration
export const XP_CONFIG = {
  correctAnswer: 10,
  streakBonus: 5,      // Per correct answer in streak
  perfectLesson: 50,   // Bonus for no mistakes
  lessonComplete: 20,  // Base XP for completing a lesson
  
  // XP thresholds for each level (0-5)
  levelThresholds: [0, 50, 150, 350, 700, 1200],
};

// Hearts Configuration
export const HEARTS_CONFIG = {
  initial: 5,
  max: 5,
  refillIntervalHours: 4,
  practiceToEarnHearts: true,
};

// Achievements
export const ACHIEVEMENTS = [
  { id: 'first-lesson', name: 'First Steps', name_zh: '第一步', description: 'Complete your first lesson', badgeIcon: 'fa-shoe-prints', criteriaType: 'lessons_completed', criteriaValue: 1 },
  { id: 'streak-3', name: '3-Day Streak', name_zh: '三天連續', description: 'Maintain a 3-day streak', badgeIcon: 'fa-fire', criteriaType: 'streak', criteriaValue: 3 },
  { id: 'streak-7', name: 'Week Warrior', name_zh: '一週戰士', description: 'Maintain a 7-day streak', badgeIcon: 'fa-fire-alt', criteriaType: 'streak', criteriaValue: 7 },
  { id: 'perfect-5', name: 'Perfectionist', name_zh: '完美主義者', description: 'Complete 5 perfect lessons', badgeIcon: 'fa-star', criteriaType: 'perfect_lessons', criteriaValue: 5 },
  { id: 'xp-1000', name: 'XP Hunter', name_zh: 'XP獵人', description: 'Earn 1000 total XP', badgeIcon: 'fa-trophy', criteriaType: 'total_xp', criteriaValue: 1000 },
  { id: 'heat-master', name: 'Heat Master', name_zh: '熱學大師', description: 'Complete all Heat and Gases skills', badgeIcon: 'fa-fire', criteriaType: 'unit_complete', criteriaValue: 'unit-1' },
  { id: 'motion-master', name: 'Motion Master', name_zh: '力學大師', description: 'Complete all Force and Motion skills', badgeIcon: 'fa-rocket', criteriaType: 'unit_complete', criteriaValue: 'unit-2' },
];

export default { SKILL_TREE_UNITS, SKILL_TREE_NODES, XP_CONFIG, HEARTS_CONFIG, ACHIEVEMENTS };


