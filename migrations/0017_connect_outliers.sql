-- Connect Outlier Nodes to Main Concepts
-- This migration ensures all nodes are connected to the main graph structure
-- Run with: wrangler d1 execute hkdse-physics-tutor-db --remote --file=./migrations/0017_connect_outliers.sql

-- ============================================
-- CONNECT ANCIENT/EARLY SCIENTISTS TO MECHANICS
-- ============================================

INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
-- Ancient scientists to classical mechanics
('archimedes_cm', 'archimedes', 'classical_mechanics', 'discovered', 'Archimedes pioneered mechanics principles'),
('aristotle_cm', 'aristotle', 'classical_mechanics', 'influenced', 'Aristotle early ideas on motion'),
('galileo_cm', 'galileo', 'classical_mechanics', 'discovered', 'Galileo founded experimental mechanics'),
('galileo_tm', 'galileo', 'theoretical_mechanics', 'discovered', 'Galileo pioneered kinematics'),
('kepler_cm', 'kepler', 'classical_mechanics', 'discovered', 'Kepler discovered planetary motion laws'),
('copernicus_cm', 'copernicus', 'classical_mechanics', 'influenced', 'Copernicus heliocentric model changed mechanics'),
('huygens_cm', 'huygens', 'classical_mechanics', 'discovered', 'Huygens contributed to mechanics and optics'),
('hooke_cm', 'hooke', 'classical_mechanics', 'discovered', 'Hooke discovered elasticity law'),
('leibniz_cm', 'leibniz', 'classical_mechanics', 'discovered', 'Leibniz contributed to dynamics'),
('bernoulli_cm', 'bernoulli_daniel', 'classical_mechanics', 'discovered', 'Bernoulli developed fluid mechanics'),
('laplace_cm', 'laplace', 'classical_mechanics', 'discovered', 'Laplace contributed to celestial mechanics');

-- ============================================
-- CONNECT OPTICS SCIENTISTS
-- ============================================

INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('alhazen_wo', 'alhazen', 'wave_optics', 'discovered', 'Alhazen father of optics'),
('alhazen_go', 'alhazen', 'geometric_optics', 'discovered', 'Alhazen studied light rays'),
('huygens_wo', 'huygens', 'wave_optics', 'discovered', 'Huygens proposed wave theory of light'),
('newton_go', 'newton', 'geometric_optics', 'discovered', 'Newton studied particle theory of light');

-- ============================================
-- CONNECT ELECTRICITY PIONEERS
-- ============================================

INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('franklin_em', 'franklin', 'electromagnetism', 'discovered', 'Franklin proved lightning is electrical'),
('volta_em', 'volta', 'electromagnetism', 'discovered', 'Volta invented the battery'),
('oersted_em', 'oersted', 'electromagnetism', 'discovered', 'Oersted discovered electromagnetism'),
('ampere_em', 'ampere', 'electromagnetism', 'discovered', 'Ampere founded electrodynamics'),
('ohm_em', 'ohm', 'electromagnetism', 'discovered', 'Ohm discovered resistance law'),
('coulomb_em', 'coulomb', 'electromagnetism', 'discovered', 'Coulomb discovered electrostatic force law'),
('tesla_em', 'tesla', 'electromagnetism', 'discovered', 'Tesla developed AC systems');

-- ============================================
-- CONNECT NUCLEAR SCIENTISTS
-- ============================================

INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('rontgen_np', 'rontgen', 'nuclear_physics', 'discovered', 'Rontgen discovered X-rays'),
('becquerel_np', 'becquerel', 'nuclear_physics', 'discovered', 'Becquerel discovered radioactivity'),
('curie_marie_np', 'curie_marie', 'nuclear_physics', 'discovered', 'Marie Curie pioneered radioactivity'),
('curie_pierre_np', 'curie_pierre', 'nuclear_physics', 'discovered', 'Pierre Curie studied radioactivity'),
('rutherford_nucl', 'rutherford', 'nuclear_physics', 'discovered', 'Rutherford discovered atomic nucleus'),
('chadwick_np', 'chadwick', 'nuclear_physics', 'discovered', 'Chadwick discovered neutron'),
('fermi_np', 'fermi', 'nuclear_physics', 'discovered', 'Fermi developed nuclear reactor'),
('oppenheimer_np', 'oppenheimer', 'nuclear_physics', 'discovered', 'Oppenheimer led atomic bomb project');

-- ============================================
-- CONNECT PARTICLE PHYSICS SCIENTISTS
-- ============================================

INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('gellmann_pp', 'gell_mann', 'particle_physics', 'discovered', 'Gell-Mann proposed quarks'),
('feynman_pp', 'feynman', 'particle_physics', 'discovered', 'Feynman developed QED'),
('schwinger_pp', 'schwinger', 'particle_physics', 'discovered', 'Schwinger developed QED'),
('weinberg_pp', 'weinberg', 'particle_physics', 'discovered', 'Weinberg unified electroweak'),
('glashow_pp', 'glashow', 'particle_physics', 'discovered', 'Glashow electroweak theory'),
('salam_pp', 'salam', 'particle_physics', 'discovered', 'Salam electroweak theory'),
('higgs_pp', 'higgs', 'particle_physics', 'discovered', 'Higgs predicted Higgs boson'),
('yang_pp', 'yang', 'particle_physics', 'discovered', 'Yang gauge theory'),
('lee_pp', 'lee', 'particle_physics', 'discovered', 'Lee parity violation');

-- ============================================
-- CONNECT RELATIVITY SCIENTISTS
-- ============================================

INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('einstein_sr_s', 'einstein', 'special_relativity', 'discovered', 'Einstein developed special relativity'),
('lorentz_sr', 'lorentz', 'special_relativity', 'discovered', 'Lorentz transformations'),
('hawking_gr', 'hawking', 'general_relativity', 'discovered', 'Hawking studied black holes');

-- ============================================
-- CONNECT REMAINING DISCOVERIES TO CONCEPTS
-- ============================================

INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
-- Discoveries to concepts
('buoyancy_cm', 'buoyancy_discovery', 'classical_mechanics', 'part_of', 'Buoyancy is part of fluid mechanics'),
('helio_cm', 'heliocentric_model', 'classical_mechanics', 'part_of', 'Heliocentric model changed celestial mechanics'),
('planet_cm', 'planetary_motion', 'classical_mechanics', 'part_of', 'Planetary motion is celestial mechanics'),
('xray_np', 'xray_discovery', 'nuclear_physics', 'part_of', 'X-rays related to atomic physics'),
('electron_qm', 'electron_discovery', 'quantum_mechanics', 'part_of', 'Electron discovery led to quantum theory'),
('nucleus_np', 'atomic_nucleus', 'nuclear_physics', 'part_of', 'Nucleus discovery founded nuclear physics'),
('proton_np', 'proton_discovery', 'nuclear_physics', 'part_of', 'Proton is nuclear physics'),
('neutron_np', 'neutron_discovery', 'nuclear_physics', 'part_of', 'Neutron is nuclear physics'),
('positron_qm', 'positron_discovery', 'quantum_mechanics', 'part_of', 'Positron confirmed Dirac equation'),
('positron_pp', 'positron_discovery', 'particle_physics', 'part_of', 'Positron is antimatter'),
('transistor_qm', 'transistor_invention', 'quantum_mechanics', 'part_of', 'Transistor uses quantum physics'),
('transistor_cm', 'transistor_invention', 'condensed_matter', 'part_of', 'Transistor is condensed matter device'),
('cmb_astro', 'cmb_discovery', 'astrophysics', 'part_of', 'CMB is astrophysics evidence'),
('topq_pp', 'top_quark', 'particle_physics', 'part_of', 'Top quark is particle physics'),
('topq_sm', 'top_quark', 'standard_model', 'part_of', 'Top quark completes Standard Model'),
('bec_qm', 'bose_einstein_condensate', 'quantum_mechanics', 'part_of', 'BEC is quantum phenomenon'),
('bh_astro', 'black_hole_image', 'astrophysics', 'part_of', 'Black hole imaging is astrophysics');

-- ============================================
-- CONNECT CONCEPTS TO EACH OTHER (hierarchy)
-- ============================================

INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('go_wo', 'geometric_optics', 'wave_optics', 'leads_to', 'Geometric optics extended by wave optics'),
('wo_em', 'wave_optics', 'electromagnetism', 'part_of', 'Light is electromagnetic wave'),
('np_pp', 'nuclear_physics', 'particle_physics', 'leads_to', 'Nuclear physics led to particle physics'),
('cm_ap', 'classical_mechanics', 'astrophysics', 'leads_to', 'Mechanics applied to celestial bodies'),
('gr_ap', 'general_relativity', 'astrophysics', 'part_of', 'GR essential for astrophysics'),
('qm_cm_cond', 'quantum_mechanics', 'condensed_matter', 'leads_to', 'QM explains condensed matter'),
('pp_sm2', 'particle_physics', 'standard_model', 'leads_to', 'Particle physics built Standard Model');

-- ============================================
-- ENSURE ALL FOUR FORCES CONNECT TO PHYSICS BRANCHES
-- ============================================

INSERT OR IGNORE INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('grav_cm', 'gravity_force', 'classical_mechanics', 'part_of', 'Gravity studied in classical mechanics'),
('grav_gr', 'gravity_force', 'general_relativity', 'part_of', 'Gravity described by general relativity'),
('emf_ed', 'em_force', 'electrodynamics', 'part_of', 'EM force is subject of electrodynamics'),
('sf_np', 'strong_force', 'nuclear_physics', 'part_of', 'Strong force binds nuclei'),
('sf_pp', 'strong_force', 'particle_physics', 'part_of', 'Strong force studied in particle physics'),
('wf_np', 'weak_force', 'nuclear_physics', 'part_of', 'Weak force causes radioactive decay'),
('wf_pp', 'weak_force', 'particle_physics', 'part_of', 'Weak force studied in particle physics');







