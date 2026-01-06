-- Improved Knowledge Graph Connections
-- Adds the Four Major Mechanics branches and connects equations to concepts
-- Run with: wrangler d1 execute hkdse-physics-tutor-db --remote --file=./migrations/0016_knowledge_graph_improved_connections.sql

-- ============================================
-- ADD FOUR MAJOR MECHANICS (四大力学) AS CONCEPTS
-- ============================================

INSERT OR REPLACE INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, category) VALUES
('theoretical_mechanics', 'concept', 'Theoretical Mechanics', '理论力学', 'Also called analytical mechanics. Studies motion using Lagrangian and Hamiltonian formulations. Foundation of classical physics.', '又称分析力学。使用拉格朗日和哈密顿方法研究运动。经典物理学的基础。', 1788, 'mechanics'),
('electrodynamics', 'concept', 'Electrodynamics', '电动力学', 'Study of electromagnetic fields and their interactions with charged particles. Based on Maxwell equations.', '研究电磁场及其与带电粒子的相互作用。基于麦克斯韦方程组。', 1865, 'electromagnetism'),
('stat_thermo', 'concept', 'Thermodynamics & Statistical Physics', '热力学与统计物理', 'Study of heat, work, entropy using both macroscopic laws and microscopic statistical methods.', '使用宏观定律和微观统计方法研究热、功、熵。', 1850, 'thermodynamics');

-- Note: quantum_mechanics already exists in the database

-- ============================================
-- ADD FOUR FUNDAMENTAL FORCES
-- ============================================

INSERT OR REPLACE INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, category) VALUES
('gravity_force', 'concept', 'Gravitational Force', '引力', 'One of four fundamental forces. Attractive force between masses. Described by Newton''s law and Einstein''s general relativity.', '四大基本力之一。质量之间的吸引力。由牛顿定律和爱因斯坦广义相对论描述。', 1687, 'mechanics'),
('em_force', 'concept', 'Electromagnetic Force', '电磁力', 'One of four fundamental forces. Force between electrically charged particles. Unified electricity and magnetism.', '四大基本力之一。带电粒子之间的作用力。统一了电和磁。', 1865, 'electromagnetism'),
('strong_force', 'concept', 'Strong Nuclear Force', '强核力', 'One of four fundamental forces. Binds quarks into protons and neutrons, and nucleons into nuclei. Described by QCD.', '四大基本力之一。将夸克束缚成质子和中子，将核子束缚成原子核。由量子色动力学描述。', 1973, 'nuclear'),
('weak_force', 'concept', 'Weak Nuclear Force', '弱核力', 'One of four fundamental forces. Responsible for radioactive decay and nuclear fusion in stars. Unified with EM force in electroweak theory.', '四大基本力之一。导致放射性衰变和恒星中的核聚变。在电弱理论中与电磁力统一。', 1933, 'nuclear');

-- ============================================
-- CONNECT EQUATIONS TO MECHANICS BRANCHES (part_of)
-- ============================================

-- Theoretical Mechanics equations
INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('newton1_tm', 'newton_first_law', 'theoretical_mechanics', 'part_of', 'Newton first law is part of theoretical mechanics'),
('newton2_tm', 'newton_second_law', 'theoretical_mechanics', 'part_of', 'Newton second law is foundation of theoretical mechanics'),
('newton3_tm', 'newton_third_law', 'theoretical_mechanics', 'part_of', 'Newton third law is part of theoretical mechanics'),
('grav_tm', 'universal_gravitation', 'theoretical_mechanics', 'part_of', 'Gravitation is part of theoretical mechanics'),
('ke_tm', 'kinetic_energy', 'theoretical_mechanics', 'part_of', 'Kinetic energy is part of theoretical mechanics'),
('momentum_tm', 'momentum', 'theoretical_mechanics', 'part_of', 'Momentum is part of theoretical mechanics'),
('angmom_tm', 'angular_momentum', 'theoretical_mechanics', 'part_of', 'Angular momentum is part of theoretical mechanics'),
('hooke_tm', 'hooke_law', 'theoretical_mechanics', 'part_of', 'Hooke law is part of theoretical mechanics'),
('kepler_tm', 'kepler_third_law', 'theoretical_mechanics', 'part_of', 'Kepler law is part of celestial mechanics'),
('bernoulli_tm', 'bernoulli_equation', 'theoretical_mechanics', 'part_of', 'Bernoulli equation is part of fluid mechanics'),
('arch_tm', 'archimedes_principle', 'theoretical_mechanics', 'part_of', 'Archimedes principle is part of fluid mechanics');

-- Electrodynamics equations
INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('coulomb_ed', 'coulomb_law', 'electrodynamics', 'part_of', 'Coulomb law is foundation of electrostatics'),
('ohm_ed', 'ohm_law', 'electrodynamics', 'part_of', 'Ohm law describes circuit behavior'),
('faraday_ed', 'faraday_induction', 'electrodynamics', 'part_of', 'Faraday law is part of electrodynamics'),
('maxwell_ed', 'maxwell_equations', 'electrodynamics', 'part_of', 'Maxwell equations are the core of electrodynamics'),
('lorentz_ed', 'lorentz_force', 'electrodynamics', 'part_of', 'Lorentz force is part of electrodynamics'),
('wave_em_ed', 'wave_equation_em', 'electrodynamics', 'part_of', 'EM wave equation derived from Maxwell equations'),
('wave_sp_ed', 'wave_speed', 'electrodynamics', 'part_of', 'Wave speed equation applies to EM waves');

-- Thermodynamics & Statistical Physics equations
INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('ideal_gas_st', 'ideal_gas_law', 'stat_thermo', 'part_of', 'Ideal gas law is part of thermodynamics'),
('first_law_st', 'first_law_thermo', 'stat_thermo', 'part_of', 'First law is foundation of thermodynamics'),
('second_law_st', 'second_law_entropy', 'stat_thermo', 'part_of', 'Second law defines entropy increase'),
('carnot_st', 'carnot_efficiency', 'stat_thermo', 'part_of', 'Carnot efficiency is part of thermodynamics'),
('boltz_st', 'boltzmann_entropy', 'stat_thermo', 'part_of', 'Boltzmann formula bridges to statistical physics'),
('heat_cap_st', 'heat_capacity', 'stat_thermo', 'part_of', 'Heat capacity is part of thermodynamics');

-- Quantum Mechanics equations
INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('planck_qm', 'planck_relation', 'quantum_mechanics', 'part_of', 'Planck relation is foundation of quantum mechanics'),
('debroglie_qm', 'de_broglie_wavelength', 'quantum_mechanics', 'part_of', 'de Broglie wavelength is part of wave mechanics'),
('schrod_qm', 'schrodinger_equation', 'quantum_mechanics', 'part_of', 'Schrödinger equation is the core of quantum mechanics'),
('heisen_qm', 'heisenberg_uncertainty', 'quantum_mechanics', 'part_of', 'Uncertainty principle is fundamental to QM'),
('dirac_qm', 'dirac_equation', 'quantum_mechanics', 'part_of', 'Dirac equation is relativistic quantum mechanics'),
('pauli_qm', 'pauli_exclusion', 'quantum_mechanics', 'part_of', 'Pauli exclusion principle is part of quantum mechanics');

-- Relativity equations (connect to both special and general relativity)
INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('emc2_sr', 'emc2', 'special_relativity', 'part_of', 'Mass-energy equivalence is part of special relativity'),
('td_sr', 'time_dilation', 'special_relativity', 'part_of', 'Time dilation is part of special relativity'),
('lc_sr', 'length_contraction', 'special_relativity', 'part_of', 'Length contraction is part of special relativity'),
('lt_sr', 'lorentz_transform', 'special_relativity', 'part_of', 'Lorentz transformation is foundation of special relativity'),
('efe_gr', 'einstein_field', 'general_relativity', 'part_of', 'Einstein field equations are the core of general relativity');

-- Optics equations
INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('snell_wo', 'snell_law', 'wave_optics', 'part_of', 'Snell law describes refraction'),
('snell_go', 'snell_law', 'geometric_optics', 'part_of', 'Snell law is used in geometric optics'),
('lens_go', 'lens_equation', 'geometric_optics', 'part_of', 'Lens equation is part of geometric optics');

-- ============================================
-- CONNECT EQUATIONS TO FUNDAMENTAL FORCES
-- ============================================

INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('grav_law_force', 'universal_gravitation', 'gravity_force', 'part_of', 'Gravitation law describes gravitational force'),
('efe_gravity', 'einstein_field', 'gravity_force', 'part_of', 'Einstein equations describe gravity as spacetime curvature'),
('coulomb_emf', 'coulomb_law', 'em_force', 'part_of', 'Coulomb law describes electrostatic force'),
('maxwell_emf', 'maxwell_equations', 'em_force', 'part_of', 'Maxwell equations describe electromagnetic force'),
('lorentz_emf', 'lorentz_force', 'em_force', 'part_of', 'Lorentz force is the EM force on charges');

-- ============================================
-- CONNECT SCIENTISTS TO MECHANICS BRANCHES
-- ============================================

INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
-- Theoretical Mechanics
('newton_tm', 'newton', 'theoretical_mechanics', 'discovered', 'Newton founded classical mechanics'),
('euler_tm', 'euler', 'theoretical_mechanics', 'discovered', 'Euler contributed to analytical mechanics'),
('lagrange_tm', 'lagrange', 'theoretical_mechanics', 'discovered', 'Lagrange developed Lagrangian mechanics'),
('hamilton_tm', 'hamilton', 'theoretical_mechanics', 'discovered', 'Hamilton developed Hamiltonian mechanics'),
-- Electrodynamics
('faraday_ed_s', 'faraday', 'electrodynamics', 'discovered', 'Faraday discovered electromagnetic induction'),
('maxwell_ed_s', 'maxwell', 'electrodynamics', 'discovered', 'Maxwell unified electromagnetism'),
('lorentz_ed_s', 'lorentz', 'electrodynamics', 'discovered', 'Lorentz contributed to electrodynamics'),
('hertz_ed_s', 'hertz', 'electrodynamics', 'discovered', 'Hertz proved electromagnetic waves'),
-- Thermodynamics & Statistical Physics
('carnot_st_s', 'carnot', 'stat_thermo', 'discovered', 'Carnot founded thermodynamics'),
('clausius_st_s', 'clausius', 'stat_thermo', 'discovered', 'Clausius developed entropy concept'),
('boltzmann_st_s', 'boltzmann', 'stat_thermo', 'discovered', 'Boltzmann founded statistical mechanics'),
('gibbs_st_s', 'gibbs', 'stat_thermo', 'discovered', 'Gibbs developed chemical thermodynamics'),
('kelvin_st_s', 'kelvin', 'stat_thermo', 'discovered', 'Kelvin contributed to thermodynamics'),
('joule_st_s', 'joule', 'stat_thermo', 'discovered', 'Joule discovered mechanical equivalent of heat'),
-- Quantum Mechanics
('planck_qm_s', 'planck', 'quantum_mechanics', 'discovered', 'Planck originated quantum theory'),
('einstein_qm_s', 'einstein', 'quantum_mechanics', 'discovered', 'Einstein contributed to quantum theory'),
('bohr_qm_s', 'bohr', 'quantum_mechanics', 'discovered', 'Bohr developed atomic model'),
('debroglie_qm_s', 'de_broglie', 'quantum_mechanics', 'discovered', 'de Broglie proposed matter waves'),
('schrodinger_qm_s', 'schrodinger', 'quantum_mechanics', 'discovered', 'Schrödinger developed wave mechanics'),
('heisenberg_qm_s', 'heisenberg', 'quantum_mechanics', 'discovered', 'Heisenberg developed matrix mechanics'),
('dirac_qm_s', 'dirac', 'quantum_mechanics', 'discovered', 'Dirac developed relativistic quantum mechanics'),
('pauli_qm_s', 'pauli', 'quantum_mechanics', 'discovered', 'Pauli discovered exclusion principle'),
('born_qm_s', 'born', 'quantum_mechanics', 'discovered', 'Born developed statistical interpretation'),
('feynman_qm_s', 'feynman', 'quantum_mechanics', 'discovered', 'Feynman developed QED and path integrals');

-- ============================================
-- CONNECT SCIENTISTS TO FUNDAMENTAL FORCES
-- ============================================

INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('newton_grav', 'newton', 'gravity_force', 'discovered', 'Newton discovered law of gravitation'),
('einstein_grav', 'einstein', 'gravity_force', 'discovered', 'Einstein described gravity as spacetime curvature'),
('maxwell_emf_s', 'maxwell', 'em_force', 'discovered', 'Maxwell unified electromagnetic force'),
('faraday_emf_s', 'faraday', 'em_force', 'discovered', 'Faraday discovered EM induction'),
('gellmann_sf', 'gell_mann', 'strong_force', 'discovered', 'Gell-Mann proposed quarks and strong force'),
('yang_sf', 'yang', 'strong_force', 'discovered', 'Yang contributed to gauge theory of strong force'),
('fermi_wf', 'fermi', 'weak_force', 'discovered', 'Fermi developed theory of weak interaction'),
('weinberg_wf', 'weinberg', 'weak_force', 'discovered', 'Weinberg unified weak and EM forces'),
('glashow_wf', 'glashow', 'weak_force', 'discovered', 'Glashow contributed to electroweak theory'),
('salam_wf', 'salam', 'weak_force', 'discovered', 'Salam contributed to electroweak unification');

-- ============================================
-- CONNECT DISCOVERIES TO FUNDAMENTAL FORCES
-- ============================================

INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('radio_wf', 'radioactivity', 'weak_force', 'part_of', 'Radioactive decay is mediated by weak force'),
('fission_sf', 'nuclear_fission', 'strong_force', 'part_of', 'Fission releases strong force binding energy'),
('fusion_sf', 'nuclear_fusion', 'strong_force', 'part_of', 'Fusion releases strong force binding energy'),
('quark_sf', 'quark_discovery', 'strong_force', 'part_of', 'Quarks are bound by strong force'),
('wz_wf', 'w_z_bosons', 'weak_force', 'part_of', 'W and Z bosons mediate weak force'),
('em_ind_emf', 'electromagnetic_induction', 'em_force', 'part_of', 'EM induction is manifestation of EM force'),
('em_wave_emf', 'electromagnetic_waves', 'em_force', 'part_of', 'EM waves are propagation of EM force'),
('grav_wave_gf', 'gravitational_waves', 'gravity_force', 'part_of', 'Gravitational waves are ripples in spacetime');

-- ============================================
-- CONNECT FOUR MECHANICS TO CONCEPTS
-- ============================================

INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('tm_cm', 'theoretical_mechanics', 'classical_mechanics', 'part_of', 'Theoretical mechanics is mathematical formulation of classical mechanics'),
('ed_em', 'electrodynamics', 'electromagnetism', 'part_of', 'Electrodynamics is advanced study of electromagnetism'),
('st_thermo', 'stat_thermo', 'thermodynamics', 'part_of', 'Stat thermo extends thermodynamics with statistical methods'),
('st_statmech', 'stat_thermo', 'statistical_mechanics', 'part_of', 'Statistical physics is part of stat thermo'),
('qm_qft', 'quantum_mechanics', 'quantum_field_theory', 'leads_to', 'QM leads to quantum field theory');

-- ============================================
-- CONNECT FUNDAMENTAL FORCES TO STANDARD MODEL
-- ============================================

INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('emf_sm', 'em_force', 'standard_model', 'part_of', 'EM force is part of Standard Model'),
('sf_sm', 'strong_force', 'standard_model', 'part_of', 'Strong force is part of Standard Model'),
('wf_sm', 'weak_force', 'standard_model', 'part_of', 'Weak force is part of Standard Model');
-- Note: Gravity is NOT part of Standard Model (it's described by General Relativity)







