-- Physics Knowledge Graph Migration
-- Run with: wrangler d1 execute hkdse-physics-tutor-db --file=./migrations/0014_knowledge_graph.sql

-- Knowledge Graph Nodes table
-- Stores scientists, equations, concepts, and discoveries
CREATE TABLE IF NOT EXISTS kg_nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('scientist', 'equation', 'concept', 'discovery')),
    name TEXT NOT NULL,
    name_zh TEXT,
    description TEXT,
    description_zh TEXT,
    year_start INTEGER,
    year_end INTEGER,
    image_url TEXT,
    formula TEXT,
    category TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Knowledge Graph Edges table
-- Stores relationships between nodes
CREATE TABLE IF NOT EXISTS kg_edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relationship TEXT NOT NULL CHECK(relationship IN ('invented_by', 'leads_to', 'part_of', 'influenced', 'discovered', 'applied_in', 'based_on')),
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (source_id) REFERENCES kg_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES kg_nodes(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON kg_nodes(type);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_category ON kg_nodes(category);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_year ON kg_nodes(year_start);
CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON kg_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON kg_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_relationship ON kg_edges(relationship);

-- Insert seed data for famous physicists and their contributions

-- Scientists
INSERT OR IGNORE INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, year_end, category) VALUES
('newton', 'scientist', 'Isaac Newton', '艾萨克·牛顿', 'English mathematician, physicist, and astronomer. Formulated laws of motion and universal gravitation.', '英国数学家、物理学家和天文学家。提出了运动定律和万有引力定律。', 1643, 1727, 'mechanics'),
('maxwell', 'scientist', 'James Clerk Maxwell', '詹姆斯·克拉克·麦克斯韦', 'Scottish physicist who formulated the classical theory of electromagnetic radiation.', '苏格兰物理学家，建立了电磁辐射的经典理论。', 1831, 1879, 'electromagnetism'),
('einstein', 'scientist', 'Albert Einstein', '阿尔伯特·爱因斯坦', 'German-born theoretical physicist, developed the theory of relativity.', '德裔理论物理学家，发展了相对论。', 1879, 1955, 'relativity'),
('planck', 'scientist', 'Max Planck', '马克斯·普朗克', 'German theoretical physicist, originator of quantum theory.', '德国理论物理学家，量子理论的创始人。', 1858, 1947, 'quantum'),
('bohr', 'scientist', 'Niels Bohr', '尼尔斯·玻尔', 'Danish physicist who made foundational contributions to understanding atomic structure.', '丹麦物理学家，对原子结构理解做出了基础性贡献。', 1885, 1962, 'quantum'),
('faraday', 'scientist', 'Michael Faraday', '迈克尔·法拉第', 'English scientist who contributed to the study of electromagnetism and electrochemistry.', '英国科学家，对电磁学和电化学研究做出了贡献。', 1791, 1867, 'electromagnetism'),
('galileo', 'scientist', 'Galileo Galilei', '伽利略·伽利莱', 'Italian astronomer, physicist, and engineer. Father of observational astronomy and modern physics.', '意大利天文学家、物理学家和工程师。观测天文学和现代物理学之父。', 1564, 1642, 'mechanics'),
('curie', 'scientist', 'Marie Curie', '玛丽·居里', 'Polish-French physicist and chemist, pioneer in radioactivity research.', '波兰裔法国物理学家和化学家，放射性研究的先驱。', 1867, 1934, 'nuclear'),
('heisenberg', 'scientist', 'Werner Heisenberg', '维尔纳·海森堡', 'German theoretical physicist, key creator of quantum mechanics.', '德国理论物理学家，量子力学的关键创建者。', 1901, 1976, 'quantum'),
('schrodinger', 'scientist', 'Erwin Schrödinger', '埃尔温·薛定谔', 'Austrian-Irish physicist who developed the wave equation in quantum mechanics.', '奥地利裔爱尔兰物理学家，发展了量子力学中的波动方程。', 1887, 1961, 'quantum');

-- Equations
INSERT OR IGNORE INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, formula, category) VALUES
('newton_second_law', 'equation', 'Newton''s Second Law', '牛顿第二定律', 'Force equals mass times acceleration. The fundamental equation of classical mechanics.', '力等于质量乘以加速度。经典力学的基本方程。', 1687, 'F = ma', 'mechanics'),
('universal_gravitation', 'equation', 'Law of Universal Gravitation', '万有引力定律', 'Every mass attracts every other mass with a force proportional to the product of their masses.', '任意两个质点之间的引力与它们质量的乘积成正比。', 1687, 'F = G(m₁m₂)/r²', 'mechanics'),
('emc2', 'equation', 'Mass-Energy Equivalence', '质能等价', 'Energy equals mass times the speed of light squared. Foundation of nuclear physics.', '能量等于质量乘以光速的平方。核物理学的基础。', 1905, 'E = mc²', 'relativity'),
('maxwell_equations', 'equation', 'Maxwell''s Equations', '麦克斯韦方程组', 'Four equations describing how electric and magnetic fields are generated and altered.', '描述电场和磁场如何产生和变化的四个方程。', 1865, '∇·E = ρ/ε₀, ∇·B = 0, ∇×E = -∂B/∂t, ∇×B = μ₀(J + ε₀∂E/∂t)', 'electromagnetism'),
('planck_energy', 'equation', 'Planck-Einstein Relation', '普朗克-爱因斯坦关系', 'Energy of a photon is proportional to its frequency.', '光子的能量与其频率成正比。', 1900, 'E = hf', 'quantum'),
('schrodinger_equation', 'equation', 'Schrödinger Equation', '薛定谔方程', 'Describes how the quantum state of a physical system changes over time.', '描述物理系统的量子态如何随时间变化。', 1926, 'iℏ∂Ψ/∂t = ĤΨ', 'quantum'),
('heisenberg_uncertainty', 'equation', 'Heisenberg Uncertainty Principle', '海森堡不确定性原理', 'The more precisely position is determined, the less precisely momentum can be known.', '位置确定得越精确，动量就越不确定。', 1927, 'ΔxΔp ≥ ℏ/2', 'quantum'),
('lorentz_force', 'equation', 'Lorentz Force', '洛伦兹力', 'Force on a charged particle in electromagnetic fields.', '电磁场中带电粒子所受的力。', 1895, 'F = q(E + v × B)', 'electromagnetism');

-- Concepts
INSERT OR IGNORE INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, category) VALUES
('classical_mechanics', 'concept', 'Classical Mechanics', '经典力学', 'Branch of physics dealing with motion of bodies under forces.', '处理物体在力作用下运动的物理学分支。', 1687, 'mechanics'),
('electromagnetism', 'concept', 'Electromagnetism', '电磁学', 'Branch of physics involving the study of electromagnetic force.', '涉及电磁力研究的物理学分支。', 1820, 'electromagnetism'),
('special_relativity', 'concept', 'Special Relativity', '狭义相对论', 'Theory of the relationship between space and time in inertial frames.', '惯性参考系中时空关系的理论。', 1905, 'relativity'),
('general_relativity', 'concept', 'General Relativity', '广义相对论', 'Geometric theory of gravitation describing gravity as spacetime curvature.', '将引力描述为时空弯曲的几何理论。', 1915, 'relativity'),
('quantum_mechanics', 'concept', 'Quantum Mechanics', '量子力学', 'Fundamental theory describing nature at atomic and subatomic scales.', '描述原子和亚原子尺度自然界的基本理论。', 1925, 'quantum'),
('thermodynamics', 'concept', 'Thermodynamics', '热力学', 'Branch of physics dealing with heat, work, and temperature.', '处理热、功和温度的物理学分支。', 1850, 'thermodynamics'),
('wave_optics', 'concept', 'Wave Optics', '波动光学', 'Study of light as waves, including interference and diffraction.', '将光作为波来研究，包括干涉和衍射。', 1801, 'optics');

-- Discoveries
INSERT OR IGNORE INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, category) VALUES
('photoelectric_effect', 'discovery', 'Photoelectric Effect', '光电效应', 'Emission of electrons when light hits a material. Explained by Einstein using quantum theory.', '光照射材料时电子的发射。爱因斯坦用量子理论解释。', 1905, 'quantum'),
('electromagnetic_induction', 'discovery', 'Electromagnetic Induction', '电磁感应', 'Production of voltage across a conductor in a changing magnetic field.', '变化磁场中导体两端产生电压。', 1831, 'electromagnetism'),
('radioactivity', 'discovery', 'Radioactivity', '放射性', 'Spontaneous emission of radiation from atomic nuclei.', '原子核自发发射辐射。', 1896, 'nuclear'),
('wave_particle_duality', 'discovery', 'Wave-Particle Duality', '波粒二象性', 'Concept that all matter exhibits both wave and particle properties.', '所有物质都表现出波动性和粒子性的概念。', 1924, 'quantum');

-- Edges (Relationships)
INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
-- Newton's contributions
('newton_second_law_inventor', 'newton_second_law', 'newton', 'invented_by', 'Newton formulated the second law of motion'),
('newton_gravity_inventor', 'universal_gravitation', 'newton', 'invented_by', 'Newton discovered universal gravitation'),
('newton_mechanics', 'newton', 'classical_mechanics', 'discovered', 'Newton founded classical mechanics'),
('galileo_newton', 'galileo', 'newton', 'influenced', 'Galileo''s work influenced Newton'),

-- Maxwell's contributions
('maxwell_eqs_inventor', 'maxwell_equations', 'maxwell', 'invented_by', 'Maxwell unified electricity and magnetism'),
('maxwell_em', 'maxwell', 'electromagnetism', 'discovered', 'Maxwell established electromagnetic theory'),
('faraday_maxwell', 'faraday', 'maxwell', 'influenced', 'Faraday''s experiments inspired Maxwell'),
('faraday_induction', 'electromagnetic_induction', 'faraday', 'invented_by', 'Faraday discovered electromagnetic induction'),

-- Einstein's contributions
('einstein_emc2', 'emc2', 'einstein', 'invented_by', 'Einstein derived mass-energy equivalence'),
('einstein_sr', 'einstein', 'special_relativity', 'discovered', 'Einstein developed special relativity'),
('einstein_gr', 'einstein', 'general_relativity', 'discovered', 'Einstein developed general relativity'),
('einstein_photoelectric', 'photoelectric_effect', 'einstein', 'invented_by', 'Einstein explained the photoelectric effect'),
('maxwell_einstein', 'maxwell', 'einstein', 'influenced', 'Maxwell''s equations influenced Einstein'),

-- Quantum pioneers
('planck_energy_inventor', 'planck_energy', 'planck', 'invented_by', 'Planck introduced energy quantization'),
('planck_qm', 'planck', 'quantum_mechanics', 'discovered', 'Planck originated quantum theory'),
('schrodinger_eq_inventor', 'schrodinger_equation', 'schrodinger', 'invented_by', 'Schrödinger developed wave mechanics'),
('heisenberg_uncertainty_inventor', 'heisenberg_uncertainty', 'heisenberg', 'invented_by', 'Heisenberg formulated uncertainty principle'),
('bohr_qm', 'bohr', 'quantum_mechanics', 'discovered', 'Bohr contributed to quantum mechanics'),
('planck_einstein_influence', 'planck', 'einstein', 'influenced', 'Planck''s work influenced Einstein'),

-- Curie
('curie_radioactivity', 'radioactivity', 'curie', 'invented_by', 'Curie pioneered radioactivity research'),

-- Concept relationships
('cm_to_sr', 'classical_mechanics', 'special_relativity', 'leads_to', 'Classical mechanics limitations led to relativity'),
('sr_to_gr', 'special_relativity', 'general_relativity', 'leads_to', 'Special relativity extended to general relativity'),
('em_to_sr', 'electromagnetism', 'special_relativity', 'leads_to', 'Electromagnetic theory led to relativity'),
('photoelectric_qm', 'photoelectric_effect', 'quantum_mechanics', 'part_of', 'Photoelectric effect is part of quantum mechanics'),
('wave_duality_qm', 'wave_particle_duality', 'quantum_mechanics', 'part_of', 'Wave-particle duality is fundamental to QM');







