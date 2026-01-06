-- Complete Physics Knowledge Graph Data
-- Comprehensive physics history from ancient times to present
-- Run with: wrangler d1 execute hkdse-physics-tutor-db --remote --file=./migrations/0015_knowledge_graph_full_data.sql

-- Clear existing data first (optional, comment out if you want to keep existing)
DELETE FROM kg_edges;
DELETE FROM kg_nodes;

-- ============================================
-- SCIENTISTS (55 entries)
-- ============================================

-- Ancient & Medieval Scientists
INSERT INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, year_end, category) VALUES
('archimedes', 'scientist', 'Archimedes', '阿基米德', 'Ancient Greek mathematician and physicist. Discovered principles of buoyancy and the lever. Famous for shouting "Eureka!"', '古希腊数学家和物理学家。发现了浮力和杠杆原理。因喊出"尤里卡"而闻名。', -287, -212, 'mechanics'),
('aristotle', 'scientist', 'Aristotle', '亚里士多德', 'Ancient Greek philosopher whose physics dominated Western thought for nearly two millennia. Proposed geocentric model.', '古希腊哲学家，其物理学思想统治西方近两千年。提出了地心说。', -384, -322, 'mechanics'),
('alhazen', 'scientist', 'Ibn al-Haytham (Alhazen)', '伊本·海赛姆', 'Arab mathematician and physicist, father of modern optics. Wrote the influential Book of Optics.', '阿拉伯数学家和物理学家，现代光学之父。著有影响深远的《光学书》。', 965, 1040, 'optics'),
('copernicus', 'scientist', 'Nicolaus Copernicus', '尼古拉·哥白尼', 'Polish astronomer who formulated heliocentric model of the universe, revolutionizing astronomy.', '波兰天文学家，提出日心说，革新了天文学。', 1473, 1543, 'mechanics');

-- Renaissance Scientists
INSERT INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, year_end, category) VALUES
('galileo', 'scientist', 'Galileo Galilei', '伽利略·伽利莱', 'Italian astronomer and physicist, father of observational astronomy and modern physics. Improved the telescope and supported heliocentrism.', '意大利天文学家和物理学家，观测天文学和现代物理学之父。改进了望远镜，支持日心说。', 1564, 1642, 'mechanics'),
('kepler', 'scientist', 'Johannes Kepler', '约翰内斯·开普勒', 'German astronomer who discovered three laws of planetary motion, foundational to celestial mechanics.', '德国天文学家，发现了行星运动三定律，奠定了天体力学基础。', 1571, 1630, 'mechanics'),
('huygens', 'scientist', 'Christiaan Huygens', '克里斯蒂安·惠更斯', 'Dutch physicist who contributed to optics and mechanics. Proposed wave theory of light and invented pendulum clock.', '荷兰物理学家，对光学和力学有重要贡献。提出光的波动说，发明了摆钟。', 1629, 1695, 'optics'),
('hooke', 'scientist', 'Robert Hooke', '罗伯特·胡克', 'English natural philosopher who discovered Hooke''s Law of elasticity and contributed to microscopy.', '英国自然哲学家，发现了胡克弹性定律，对显微镜学有贡献。', 1635, 1703, 'mechanics');

-- Classical Mechanics Era
INSERT INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, year_end, category) VALUES
('newton', 'scientist', 'Isaac Newton', '艾萨克·牛顿', 'English mathematician and physicist. Formulated laws of motion, universal gravitation, and co-invented calculus. One of the most influential scientists ever.', '英国数学家和物理学家。提出了运动定律、万有引力定律，共同发明了微积分。有史以来最有影响力的科学家之一。', 1643, 1727, 'mechanics'),
('leibniz', 'scientist', 'Gottfried Wilhelm Leibniz', '戈特弗里德·威廉·莱布尼茨', 'German mathematician and philosopher who co-invented calculus and contributed to dynamics.', '德国数学家和哲学家，共同发明了微积分，对动力学有贡献。', 1646, 1716, 'mechanics'),
('bernoulli_daniel', 'scientist', 'Daniel Bernoulli', '丹尼尔·伯努利', 'Swiss mathematician and physicist known for Bernoulli''s principle in fluid dynamics.', '瑞士数学家和物理学家，以流体力学中的伯努利原理闻名。', 1700, 1782, 'mechanics'),
('euler', 'scientist', 'Leonhard Euler', '莱昂哈德·欧拉', 'Swiss mathematician and physicist who made major contributions to mechanics, fluid dynamics, and optics.', '瑞士数学家和物理学家，对力学、流体动力学和光学有重大贡献。', 1707, 1783, 'mechanics'),
('lagrange', 'scientist', 'Joseph-Louis Lagrange', '约瑟夫-路易·拉格朗日', 'Italian-French mathematician who developed analytical mechanics and Lagrangian mechanics.', '意大利裔法国数学家，发展了分析力学和拉格朗日力学。', 1736, 1813, 'mechanics'),
('laplace', 'scientist', 'Pierre-Simon Laplace', '皮埃尔-西蒙·拉普拉斯', 'French mathematician and astronomer known for work on celestial mechanics and probability theory.', '法国数学家和天文学家，以天体力学和概率论著称。', 1749, 1827, 'mechanics'),
('hamilton', 'scientist', 'William Rowan Hamilton', '威廉·罗恩·哈密顿', 'Irish mathematician who developed Hamiltonian mechanics, foundational to quantum mechanics.', '爱尔兰数学家，发展了哈密顿力学，为量子力学奠定基础。', 1805, 1865, 'mechanics');

-- Thermodynamics Pioneers
INSERT INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, year_end, category) VALUES
('carnot', 'scientist', 'Sadi Carnot', '萨迪·卡诺', 'French physicist and engineer, founder of thermodynamics. Described the ideal heat engine (Carnot cycle).', '法国物理学家和工程师，热力学创始人。描述了理想热机（卡诺循环）。', 1796, 1832, 'thermodynamics'),
('joule', 'scientist', 'James Prescott Joule', '詹姆斯·普雷斯科特·焦耳', 'English physicist who discovered the mechanical equivalent of heat and contributed to the first law of thermodynamics.', '英国物理学家，发现了热功当量，对热力学第一定律有贡献。', 1818, 1889, 'thermodynamics'),
('clausius', 'scientist', 'Rudolf Clausius', '鲁道夫·克劳修斯', 'German physicist who formulated the second law of thermodynamics and introduced the concept of entropy.', '德国物理学家，建立了热力学第二定律，引入了熵的概念。', 1822, 1888, 'thermodynamics'),
('kelvin', 'scientist', 'Lord Kelvin (William Thomson)', '开尔文勋爵（威廉·汤姆森）', 'British mathematical physicist who proposed the absolute temperature scale and contributed to thermodynamics.', '英国数理物理学家，提出了绝对温标，对热力学有贡献。', 1824, 1907, 'thermodynamics'),
('boltzmann', 'scientist', 'Ludwig Boltzmann', '路德维希·玻尔兹曼', 'Austrian physicist who developed statistical mechanics and the kinetic theory of gases.', '奥地利物理学家，发展了统计力学和气体动理论。', 1844, 1906, 'thermodynamics'),
('gibbs', 'scientist', 'Josiah Willard Gibbs', '乔赛亚·威拉德·吉布斯', 'American scientist who founded chemical thermodynamics and introduced Gibbs free energy.', '美国科学家，创立了化学热力学，引入了吉布斯自由能。', 1839, 1903, 'thermodynamics');

-- Electromagnetism Pioneers
INSERT INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, year_end, category) VALUES
('franklin', 'scientist', 'Benjamin Franklin', '本杰明·富兰克林', 'American polymath who proved lightning is electrical and invented the lightning rod.', '美国博学家，证明了闪电是电现象，发明了避雷针。', 1706, 1790, 'electromagnetism'),
('coulomb', 'scientist', 'Charles-Augustin de Coulomb', '夏尔-奥古斯丁·库仑', 'French physicist who discovered Coulomb''s law describing electrostatic force between charges.', '法国物理学家，发现了描述电荷间静电力的库仑定律。', 1736, 1806, 'electromagnetism'),
('volta', 'scientist', 'Alessandro Volta', '亚历山德罗·伏特', 'Italian physicist who invented the electric battery (voltaic pile), enabling continuous electric current.', '意大利物理学家，发明了电池（伏打电堆），实现了持续电流。', 1745, 1827, 'electromagnetism'),
('oersted', 'scientist', 'Hans Christian Ørsted', '汉斯·克里斯蒂安·奥斯特', 'Danish physicist who discovered that electric currents create magnetic fields.', '丹麦物理学家，发现了电流产生磁场。', 1777, 1851, 'electromagnetism'),
('ampere', 'scientist', 'André-Marie Ampère', '安德烈-马里·安培', 'French physicist who founded electrodynamics. Formulated Ampère''s circuital law.', '法国物理学家，创立了电动力学。提出了安培环路定律。', 1775, 1836, 'electromagnetism'),
('ohm', 'scientist', 'Georg Ohm', '格奥尔格·欧姆', 'German physicist who discovered Ohm''s law relating voltage, current, and resistance.', '德国物理学家，发现了描述电压、电流和电阻关系的欧姆定律。', 1789, 1854, 'electromagnetism'),
('faraday', 'scientist', 'Michael Faraday', '迈克尔·法拉第', 'English scientist who discovered electromagnetic induction and established the basis for electric motors and generators.', '英国科学家，发现了电磁感应，为电动机和发电机奠定了基础。', 1791, 1867, 'electromagnetism'),
('maxwell', 'scientist', 'James Clerk Maxwell', '詹姆斯·克拉克·麦克斯韦', 'Scottish physicist who unified electricity, magnetism, and light in Maxwell''s equations. Predicted electromagnetic waves.', '苏格兰物理学家，用麦克斯韦方程组统一了电、磁和光。预言了电磁波。', 1831, 1879, 'electromagnetism'),
('hertz', 'scientist', 'Heinrich Hertz', '海因里希·赫兹', 'German physicist who first proved the existence of electromagnetic waves predicted by Maxwell.', '德国物理学家，首次证明了麦克斯韦预言的电磁波的存在。', 1857, 1894, 'electromagnetism'),
('lorentz', 'scientist', 'Hendrik Lorentz', '亨德里克·洛伦兹', 'Dutch physicist who developed the Lorentz transformations and the electron theory of matter.', '荷兰物理学家，发展了洛伦兹变换和物质的电子理论。', 1853, 1928, 'electromagnetism'),
('tesla', 'scientist', 'Nikola Tesla', '尼古拉·特斯拉', 'Serbian-American inventor who developed AC electrical systems and the Tesla coil.', '塞尔维亚裔美国发明家，发展了交流电系统和特斯拉线圈。', 1856, 1943, 'electromagnetism');

-- Radioactivity and Nuclear Pioneers
INSERT INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, year_end, category) VALUES
('rontgen', 'scientist', 'Wilhelm Röntgen', '威廉·伦琴', 'German physicist who discovered X-rays, earning the first Nobel Prize in Physics.', '德国物理学家，发现了X射线，获得首届诺贝尔物理学奖。', 1845, 1923, 'nuclear'),
('becquerel', 'scientist', 'Henri Becquerel', '亨利·贝克勒尔', 'French physicist who discovered radioactivity, sharing the Nobel Prize with the Curies.', '法国物理学家，发现了放射性，与居里夫妇共获诺贝尔奖。', 1852, 1908, 'nuclear'),
('curie_marie', 'scientist', 'Marie Curie', '玛丽·居里', 'Polish-French physicist who pioneered radioactivity research. First woman to win Nobel Prize, only person to win in two sciences.', '波兰裔法国物理学家，开创了放射性研究。首位获诺贝尔奖的女性，唯一获两个科学领域诺贝尔奖的人。', 1867, 1934, 'nuclear'),
('curie_pierre', 'scientist', 'Pierre Curie', '皮埃尔·居里', 'French physicist who co-discovered polonium and radium with Marie Curie. Pioneered radioactivity research.', '法国物理学家，与玛丽·居里共同发现了钋和镭。开创了放射性研究。', 1859, 1906, 'nuclear'),
('rutherford', 'scientist', 'Ernest Rutherford', '欧内斯特·卢瑟福', 'New Zealand-British physicist who discovered the atomic nucleus and proton. Father of nuclear physics.', '新西兰裔英国物理学家，发现了原子核和质子。核物理学之父。', 1871, 1937, 'nuclear'),
('chadwick', 'scientist', 'James Chadwick', '詹姆斯·查德威克', 'British physicist who discovered the neutron in 1932, crucial for nuclear fission.', '英国物理学家，于1932年发现了中子，对核裂变至关重要。', 1891, 1974, 'nuclear');

-- Quantum Mechanics Pioneers
INSERT INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, year_end, category) VALUES
('planck', 'scientist', 'Max Planck', '马克斯·普朗克', 'German physicist who originated quantum theory by discovering energy quantization. Nobel Prize 1918.', '德国物理学家，通过发现能量量子化开创了量子理论。1918年诺贝尔奖。', 1858, 1947, 'quantum'),
('einstein', 'scientist', 'Albert Einstein', '阿尔伯特·爱因斯坦', 'German-born physicist who developed special and general relativity, explained photoelectric effect, and contributed to quantum theory.', '德裔物理学家，发展了狭义和广义相对论，解释了光电效应，对量子理论有贡献。', 1879, 1955, 'relativity'),
('bohr', 'scientist', 'Niels Bohr', '尼尔斯·玻尔', 'Danish physicist who developed the Bohr model of the atom and contributed to quantum mechanics and nuclear physics.', '丹麦物理学家，发展了玻尔原子模型，对量子力学和核物理有贡献。', 1885, 1962, 'quantum'),
('de_broglie', 'scientist', 'Louis de Broglie', '路易·德布罗意', 'French physicist who proposed wave-particle duality, stating matter has wave properties.', '法国物理学家，提出波粒二象性，认为物质具有波动性。', 1892, 1987, 'quantum'),
('schrodinger', 'scientist', 'Erwin Schrödinger', '埃尔温·薛定谔', 'Austrian physicist who developed wave mechanics and the Schrödinger equation, fundamental to quantum mechanics.', '奥地利物理学家，发展了波动力学和薛定谔方程，是量子力学的基础。', 1887, 1961, 'quantum'),
('heisenberg', 'scientist', 'Werner Heisenberg', '维尔纳·海森堡', 'German physicist who created matrix mechanics and discovered the uncertainty principle.', '德国物理学家，创立了矩阵力学，发现了不确定性原理。', 1901, 1976, 'quantum'),
('dirac', 'scientist', 'Paul Dirac', '保罗·狄拉克', 'British physicist who formulated the Dirac equation, predicted antimatter, and contributed to quantum electrodynamics.', '英国物理学家，建立了狄拉克方程，预言了反物质，对量子电动力学有贡献。', 1902, 1984, 'quantum'),
('pauli', 'scientist', 'Wolfgang Pauli', '沃尔夫冈·泡利', 'Austrian physicist who discovered the exclusion principle, fundamental to understanding atomic structure.', '奥地利物理学家，发现了不相容原理，对理解原子结构至关重要。', 1900, 1958, 'quantum'),
('born', 'scientist', 'Max Born', '马克斯·玻恩', 'German physicist who developed the statistical interpretation of quantum mechanics.', '德国物理学家，发展了量子力学的统计诠释。', 1882, 1970, 'quantum');

-- Modern and Contemporary Physicists
INSERT INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, year_end, category) VALUES
('fermi', 'scientist', 'Enrico Fermi', '恩里科·费米', 'Italian-American physicist who developed nuclear reactor, contributed to quantum theory and nuclear physics.', '意大利裔美国物理学家，发展了核反应堆，对量子理论和核物理有贡献。', 1901, 1954, 'nuclear'),
('oppenheimer', 'scientist', 'J. Robert Oppenheimer', 'J·罗伯特·奥本海默', 'American physicist who directed the Manhattan Project developing the first nuclear weapons.', '美国物理学家，领导曼哈顿计划开发第一颗核武器。', 1904, 1967, 'nuclear'),
('feynman', 'scientist', 'Richard Feynman', '理查德·费曼', 'American physicist who developed quantum electrodynamics and Feynman diagrams. Nobel Prize 1965.', '美国物理学家，发展了量子电动力学和费曼图。1965年诺贝尔奖。', 1918, 1988, 'quantum'),
('schwinger', 'scientist', 'Julian Schwinger', '朱利安·施温格', 'American physicist who developed quantum electrodynamics, sharing Nobel Prize with Feynman.', '美国物理学家，发展了量子电动力学，与费曼共获诺贝尔奖。', 1918, 1994, 'quantum'),
('gell_mann', 'scientist', 'Murray Gell-Mann', '默里·盖尔曼', 'American physicist who proposed quarks and developed the quark model of hadrons.', '美国物理学家，提出夸克概念，发展了强子的夸克模型。', 1929, 2019, 'quantum'),
('weinberg', 'scientist', 'Steven Weinberg', '史蒂文·温伯格', 'American physicist who unified electromagnetic and weak forces in electroweak theory.', '美国物理学家，在电弱理论中统一了电磁力和弱力。', 1933, 2021, 'quantum'),
('glashow', 'scientist', 'Sheldon Glashow', '谢尔登·格拉肖', 'American physicist who contributed to electroweak unification. Nobel Prize 1979.', '美国物理学家，对电弱统一有贡献。1979年诺贝尔奖。', 1932, NULL, 'quantum'),
('salam', 'scientist', 'Abdus Salam', '阿卜杜勒·萨拉姆', 'Pakistani physicist who contributed to electroweak theory. First Muslim Nobel laureate in science.', '巴基斯坦物理学家，对电弱理论有贡献。首位穆斯林科学诺贝尔奖得主。', 1926, 1996, 'quantum'),
('hawking', 'scientist', 'Stephen Hawking', '史蒂芬·霍金', 'British theoretical physicist known for work on black holes and Hawking radiation.', '英国理论物理学家，以黑洞和霍金辐射研究闻名。', 1942, 2018, 'relativity'),
('higgs', 'scientist', 'Peter Higgs', '彼得·希格斯', 'British physicist who predicted the Higgs boson, confirmed in 2012 at CERN.', '英国物理学家，预言了希格斯玻色子，2012年在CERN得到证实。', 1929, 2024, 'quantum'),
('yang', 'scientist', 'Chen-Ning Yang', '杨振宁', 'Chinese-American physicist who made contributions to gauge theory and parity violation.', '华裔美国物理学家，对规范理论和宇称不守恒有贡献。', 1922, NULL, 'quantum'),
('lee', 'scientist', 'Tsung-Dao Lee', '李政道', 'Chinese-American physicist who co-discovered parity violation with Yang. Nobel Prize 1957.', '华裔美国物理学家，与杨振宁共同发现宇称不守恒。1957年诺贝尔奖。', 1926, 2024, 'quantum');

-- ============================================
-- EQUATIONS (35 entries)
-- ============================================

-- Classical Mechanics Equations
INSERT INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, formula, category) VALUES
('archimedes_principle', 'equation', 'Archimedes'' Principle', '阿基米德原理', 'Buoyant force equals the weight of displaced fluid.', '浮力等于排开流体的重量。', -250, 'F_b = ρ_fluid × V × g', 'mechanics'),
('hooke_law', 'equation', 'Hooke''s Law', '胡克定律', 'Force in a spring is proportional to displacement.', '弹簧中的力与位移成正比。', 1660, 'F = -kx', 'mechanics'),
('newton_first_law', 'equation', 'Newton''s First Law', '牛顿第一定律', 'An object remains at rest or in uniform motion unless acted upon by a force.', '物体保持静止或匀速直线运动，除非受到力的作用。', 1687, 'Σ→F = 0 ⟹ →v = constant', 'mechanics'),
('newton_second_law', 'equation', 'Newton''s Second Law', '牛顿第二定律', 'Force equals mass times acceleration.', '力等于质量乘以加速度。', 1687, 'F = ma', 'mechanics'),
('newton_third_law', 'equation', 'Newton''s Third Law', '牛顿第三定律', 'Every action has an equal and opposite reaction.', '每个作用力都有一个大小相等、方向相反的反作用力。', 1687, 'F_AB = -F_BA', 'mechanics'),
('universal_gravitation', 'equation', 'Law of Universal Gravitation', '万有引力定律', 'Gravitational force between two masses is proportional to their masses and inversely proportional to distance squared.', '两个质量之间的引力与它们的质量乘积成正比，与距离的平方成反比。', 1687, 'F = G(m₁m₂)/r²', 'mechanics'),
('kinetic_energy', 'equation', 'Kinetic Energy', '动能公式', 'Energy of motion equals half mass times velocity squared.', '运动的能量等于质量乘以速度平方的一半。', 1689, 'E_k = ½mv²', 'mechanics'),
('momentum', 'equation', 'Momentum', '动量公式', 'Momentum equals mass times velocity.', '动量等于质量乘以速度。', 1687, 'p = mv', 'mechanics'),
('angular_momentum', 'equation', 'Angular Momentum', '角动量', 'Angular momentum of a rotating body.', '旋转物体的角动量。', 1750, 'L = Iω', 'mechanics'),
('bernoulli_equation', 'equation', 'Bernoulli''s Equation', '伯努利方程', 'Energy conservation in fluid flow.', '流体流动中的能量守恒。', 1738, 'P + ½ρv² + ρgh = constant', 'mechanics'),
('kepler_third_law', 'equation', 'Kepler''s Third Law', '开普勒第三定律', 'Square of orbital period is proportional to cube of semi-major axis.', '轨道周期的平方与半长轴的立方成正比。', 1619, 'T² ∝ a³', 'mechanics');

-- Thermodynamics Equations
INSERT INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, formula, category) VALUES
('ideal_gas_law', 'equation', 'Ideal Gas Law', '理想气体定律', 'Relates pressure, volume, temperature, and amount of ideal gas.', '联系理想气体的压强、体积、温度和物质的量。', 1834, 'PV = nRT', 'thermodynamics'),
('first_law_thermo', 'equation', 'First Law of Thermodynamics', '热力学第一定律', 'Energy conservation: internal energy change equals heat minus work.', '能量守恒：内能变化等于热量减去功。', 1850, 'ΔU = Q - W', 'thermodynamics'),
('second_law_entropy', 'equation', 'Second Law of Thermodynamics', '热力学第二定律', 'Entropy of an isolated system never decreases.', '孤立系统的熵永不减少。', 1865, 'ΔS ≥ 0', 'thermodynamics'),
('carnot_efficiency', 'equation', 'Carnot Efficiency', '卡诺效率', 'Maximum efficiency of a heat engine between two temperatures.', '两个温度之间热机的最大效率。', 1824, 'η = 1 - T_cold/T_hot', 'thermodynamics'),
('boltzmann_entropy', 'equation', 'Boltzmann Entropy Formula', '玻尔兹曼熵公式', 'Entropy is proportional to the logarithm of the number of microstates.', '熵与微观态数的对数成正比。', 1877, 'S = k_B ln W', 'thermodynamics'),
('heat_capacity', 'equation', 'Heat Capacity Equation', '热容方程', 'Heat required to change temperature.', '改变温度所需的热量。', 1760, 'Q = mcΔT', 'thermodynamics');

-- Electromagnetism Equations
INSERT INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, formula, category) VALUES
('coulomb_law', 'equation', 'Coulomb''s Law', '库仑定律', 'Electrostatic force between two charges is proportional to product of charges divided by distance squared.', '两个电荷之间的静电力与电荷乘积成正比，与距离的平方成反比。', 1785, 'F = k(q₁q₂)/r²', 'electromagnetism'),
('ohm_law', 'equation', 'Ohm''s Law', '欧姆定律', 'Voltage equals current times resistance.', '电压等于电流乘以电阻。', 1827, 'V = IR', 'electromagnetism'),
('faraday_induction', 'equation', 'Faraday''s Law of Induction', '法拉第电磁感应定律', 'Induced EMF equals negative rate of change of magnetic flux.', '感应电动势等于磁通量变化率的负值。', 1831, 'ε = -dΦ_B/dt', 'electromagnetism'),
('maxwell_equations', 'equation', 'Maxwell''s Equations', '麦克斯韦方程组', 'Four equations unifying electricity and magnetism, predicting electromagnetic waves.', '统一电和磁的四个方程，预言了电磁波。', 1865, '∇·E = ρ/ε₀, ∇·B = 0, ∇×E = -∂B/∂t, ∇×B = μ₀J + μ₀ε₀∂E/∂t', 'electromagnetism'),
('lorentz_force', 'equation', 'Lorentz Force Law', '洛伦兹力定律', 'Force on a charged particle in electromagnetic fields.', '电磁场中带电粒子所受的力。', 1895, 'F = q(E + v × B)', 'electromagnetism'),
('wave_equation_em', 'equation', 'Electromagnetic Wave Equation', '电磁波方程', 'Speed of light from Maxwell''s equations.', '从麦克斯韦方程组得出光速。', 1865, 'c = 1/√(μ₀ε₀)', 'electromagnetism');

-- Wave and Optics Equations
INSERT INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, formula, category) VALUES
('wave_speed', 'equation', 'Wave Speed Equation', '波速公式', 'Wave speed equals frequency times wavelength.', '波速等于频率乘以波长。', 1678, 'v = fλ', 'optics'),
('snell_law', 'equation', 'Snell''s Law', '斯涅尔定律', 'Relates angles of incidence and refraction to refractive indices.', '联系入射角和折射角与折射率。', 1621, 'n₁sin θ₁ = n₂sin θ₂', 'optics'),
('lens_equation', 'equation', 'Thin Lens Equation', '薄透镜方程', 'Relates object distance, image distance, and focal length.', '联系物距、像距和焦距。', 1693, '1/f = 1/d_o + 1/d_i', 'optics');

-- Relativity Equations
INSERT INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, formula, category) VALUES
('emc2', 'equation', 'Mass-Energy Equivalence', '质能等价', 'Energy equals mass times speed of light squared.', '能量等于质量乘以光速的平方。', 1905, 'E = mc²', 'relativity'),
('time_dilation', 'equation', 'Time Dilation', '时间膨胀', 'Time runs slower for moving observers.', '运动观察者的时间变慢。', 1905, 't'' = t/√(1 - v²/c²)', 'relativity'),
('length_contraction', 'equation', 'Length Contraction', '长度收缩', 'Moving objects appear shorter in direction of motion.', '运动物体在运动方向上看起来更短。', 1905, 'L'' = L√(1 - v²/c²)', 'relativity'),
('lorentz_transform', 'equation', 'Lorentz Transformation', '洛伦兹变换', 'Transformation between inertial reference frames.', '惯性参考系之间的变换。', 1904, 'x'' = γ(x - vt), t'' = γ(t - vx/c²)', 'relativity'),
('einstein_field', 'equation', 'Einstein Field Equations', '爱因斯坦场方程', 'Describes how matter curves spacetime in general relativity.', '描述广义相对论中物质如何弯曲时空。', 1915, 'G_μν + Λg_μν = (8πG/c⁴)T_μν', 'relativity');

-- Quantum Mechanics Equations
INSERT INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, formula, category) VALUES
('planck_relation', 'equation', 'Planck-Einstein Relation', '普朗克-爱因斯坦关系', 'Energy of a photon is proportional to its frequency.', '光子的能量与其频率成正比。', 1900, 'E = hf', 'quantum'),
('de_broglie_wavelength', 'equation', 'de Broglie Wavelength', '德布罗意波长', 'Wavelength of matter waves equals Planck constant divided by momentum.', '物质波的波长等于普朗克常数除以动量。', 1924, 'λ = h/p', 'quantum'),
('schrodinger_equation', 'equation', 'Schrödinger Equation', '薛定谔方程', 'Describes how quantum state evolves over time.', '描述量子态如何随时间演化。', 1926, 'iℏ∂Ψ/∂t = ĤΨ', 'quantum'),
('heisenberg_uncertainty', 'equation', 'Heisenberg Uncertainty Principle', '海森堡不确定性原理', 'Position and momentum cannot both be precisely measured.', '位置和动量不能同时精确测量。', 1927, 'ΔxΔp ≥ ℏ/2', 'quantum'),
('dirac_equation', 'equation', 'Dirac Equation', '狄拉克方程', 'Relativistic wave equation for spin-½ particles.', '自旋1/2粒子的相对论波动方程。', 1928, '(iγ^μ∂_μ - m)ψ = 0', 'quantum'),
('pauli_exclusion', 'equation', 'Pauli Exclusion Principle', '泡利不相容原理', 'No two fermions can occupy the same quantum state.', '两个费米子不能占据同一量子态。', 1925, 'ψ(1,2) = -ψ(2,1)', 'quantum');

-- ============================================
-- CONCEPTS (15 entries)
-- ============================================

INSERT INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, category) VALUES
('classical_mechanics', 'concept', 'Classical Mechanics', '经典力学', 'Branch of physics dealing with motion of macroscopic bodies under forces, based on Newton''s laws.', '处理宏观物体在力作用下运动的物理学分支，基于牛顿定律。', 1687, 'mechanics'),
('thermodynamics', 'concept', 'Thermodynamics', '热力学', 'Study of heat, work, temperature, and energy transfer in systems.', '研究系统中热、功、温度和能量传递。', 1824, 'thermodynamics'),
('statistical_mechanics', 'concept', 'Statistical Mechanics', '统计力学', 'Explains thermodynamics using probability theory applied to large numbers of particles.', '用概率论应用于大量粒子来解释热力学。', 1870, 'thermodynamics'),
('electromagnetism', 'concept', 'Electromagnetism', '电磁学', 'Study of electric and magnetic fields and their interactions with matter.', '研究电场和磁场及其与物质的相互作用。', 1820, 'electromagnetism'),
('wave_optics', 'concept', 'Wave Optics', '波动光学', 'Study of light as waves, including interference, diffraction, and polarization.', '将光作为波来研究，包括干涉、衍射和偏振。', 1801, 'optics'),
('geometric_optics', 'concept', 'Geometric Optics', '几何光学', 'Study of light as rays, applicable when wavelength is much smaller than objects.', '将光作为光线来研究，适用于波长远小于物体的情况。', 1600, 'optics'),
('special_relativity', 'concept', 'Special Relativity', '狭义相对论', 'Theory of space and time in inertial reference frames, establishing speed of light as universal constant.', '惯性参考系中时空理论，确立光速为宇宙常数。', 1905, 'relativity'),
('general_relativity', 'concept', 'General Relativity', '广义相对论', 'Geometric theory of gravity describing gravity as curvature of spacetime caused by mass and energy.', '引力的几何理论，将引力描述为质量和能量引起的时空弯曲。', 1915, 'relativity'),
('quantum_mechanics', 'concept', 'Quantum Mechanics', '量子力学', 'Fundamental theory describing nature at atomic and subatomic scales using wave functions and probability.', '描述原子和亚原子尺度自然界的基本理论，使用波函数和概率。', 1925, 'quantum'),
('quantum_field_theory', 'concept', 'Quantum Field Theory', '量子场论', 'Framework combining quantum mechanics and special relativity to describe particles as field excitations.', '结合量子力学和狭义相对论，将粒子描述为场的激发。', 1930, 'quantum'),
('nuclear_physics', 'concept', 'Nuclear Physics', '核物理学', 'Study of atomic nuclei, their constituents, and interactions including radioactivity.', '研究原子核、其组成和相互作用，包括放射性。', 1911, 'nuclear'),
('particle_physics', 'concept', 'Particle Physics', '粒子物理学', 'Study of fundamental particles and forces, seeking to understand the building blocks of matter.', '研究基本粒子和力，寻求理解物质的基本组成。', 1930, 'quantum'),
('astrophysics', 'concept', 'Astrophysics', '天体物理学', 'Application of physics to understand celestial objects and cosmic phenomena.', '应用物理学来理解天体和宇宙现象。', 1860, 'relativity'),
('condensed_matter', 'concept', 'Condensed Matter Physics', '凝聚态物理', 'Study of physical properties of condensed phases of matter including solids and liquids.', '研究物质凝聚相（包括固体和液体）的物理性质。', 1900, 'quantum'),
('standard_model', 'concept', 'Standard Model', '标准模型', 'Theory describing electromagnetic, weak, and strong forces and classifying all known subatomic particles.', '描述电磁力、弱力和强力并分类所有已知亚原子粒子的理论。', 1970, 'quantum');

-- ============================================
-- DISCOVERIES (25 entries)
-- ============================================

INSERT INTO kg_nodes (id, type, name, name_zh, description, description_zh, year_start, category) VALUES
('buoyancy_discovery', 'discovery', 'Principle of Buoyancy', '浮力原理发现', 'Archimedes discovered that objects in fluid experience upward force equal to weight of displaced fluid.', '阿基米德发现流体中的物体受到向上的力，等于排开流体的重量。', -250, 'mechanics'),
('heliocentric_model', 'discovery', 'Heliocentric Model', '日心说', 'Copernicus proposed that Earth and planets orbit the Sun, overthrowing geocentric worldview.', '哥白尼提出地球和行星围绕太阳运行，推翻了地心说世界观。', 1543, 'mechanics'),
('planetary_motion', 'discovery', 'Laws of Planetary Motion', '行星运动定律', 'Kepler discovered three laws describing how planets orbit the Sun in ellipses.', '开普勒发现了描述行星如何沿椭圆轨道绕太阳运行的三条定律。', 1609, 'mechanics'),
('electromagnetic_induction', 'discovery', 'Electromagnetic Induction', '电磁感应发现', 'Faraday discovered that changing magnetic fields induce electric currents.', '法拉第发现变化的磁场感应出电流。', 1831, 'electromagnetism'),
('electromagnetic_waves', 'discovery', 'Electromagnetic Waves', '电磁波发现', 'Hertz experimentally confirmed Maxwell''s prediction of electromagnetic waves traveling at light speed.', '赫兹实验证实了麦克斯韦关于电磁波以光速传播的预言。', 1887, 'electromagnetism'),
('xray_discovery', 'discovery', 'X-ray Discovery', 'X射线发现', 'Röntgen accidentally discovered X-rays while experimenting with cathode rays.', '伦琴在实验阴极射线时意外发现了X射线。', 1895, 'nuclear'),
('radioactivity', 'discovery', 'Radioactivity', '放射性发现', 'Becquerel discovered spontaneous emission of radiation from uranium.', '贝克勒尔发现铀自发发射辐射。', 1896, 'nuclear'),
('electron_discovery', 'discovery', 'Discovery of the Electron', '电子发现', 'Thomson discovered the electron as a subatomic particle through cathode ray experiments.', '汤姆孙通过阴极射线实验发现电子是亚原子粒子。', 1897, 'quantum'),
('photoelectric_effect', 'discovery', 'Photoelectric Effect', '光电效应', 'Einstein explained how light ejects electrons from metals, proving light has particle nature.', '爱因斯坦解释了光如何从金属中射出电子，证明光具有粒子性。', 1905, 'quantum'),
('atomic_nucleus', 'discovery', 'Discovery of Atomic Nucleus', '原子核发现', 'Rutherford discovered the dense positively charged nucleus through gold foil experiment.', '卢瑟福通过金箔实验发现了密集的带正电的原子核。', 1911, 'nuclear'),
('proton_discovery', 'discovery', 'Discovery of the Proton', '质子发现', 'Rutherford identified the proton as a constituent of all atomic nuclei.', '卢瑟福确认质子是所有原子核的组成部分。', 1919, 'nuclear'),
('neutron_discovery', 'discovery', 'Discovery of the Neutron', '中子发现', 'Chadwick discovered the electrically neutral neutron in atomic nuclei.', '查德威克发现了原子核中电中性的中子。', 1932, 'nuclear'),
('wave_particle_duality', 'discovery', 'Wave-Particle Duality', '波粒二象性', 'de Broglie proposed and experiments confirmed that all matter has both wave and particle properties.', '德布罗意提出并实验证实所有物质都具有波动性和粒子性。', 1924, 'quantum'),
('positron_discovery', 'discovery', 'Discovery of Positron', '正电子发现', 'Anderson discovered the positron, the first confirmed antimatter particle.', '安德森发现了正电子，第一个被证实的反物质粒子。', 1932, 'quantum'),
('nuclear_fission', 'discovery', 'Nuclear Fission', '核裂变发现', 'Hahn and Strassmann discovered that uranium nuclei can split, releasing enormous energy.', '哈恩和施特拉斯曼发现铀核可以分裂，释放巨大能量。', 1938, 'nuclear'),
('nuclear_fusion', 'discovery', 'Nuclear Fusion', '核聚变', 'Understanding that fusion powers the Sun, combining light nuclei to release energy.', '理解核聚变为太阳提供能量，轻核聚合释放能量。', 1939, 'nuclear'),
('transistor_invention', 'discovery', 'Transistor Invention', '晶体管发明', 'Bardeen, Brattain, and Shockley invented the transistor, enabling modern electronics.', '巴丁、布拉顿和肖克利发明了晶体管，使现代电子学成为可能。', 1947, 'quantum'),
('cmb_discovery', 'discovery', 'Cosmic Microwave Background', '宇宙微波背景辐射', 'Penzias and Wilson discovered the afterglow of the Big Bang, confirming cosmological theory.', '彭齐亚斯和威尔逊发现大爆炸余晖，证实了宇宙学理论。', 1965, 'relativity'),
('quark_discovery', 'discovery', 'Quark Discovery', '夸克发现', 'Deep inelastic scattering experiments confirmed quarks as constituents of protons and neutrons.', '深度非弹性散射实验证实夸克是质子和中子的组成部分。', 1968, 'quantum'),
('w_z_bosons', 'discovery', 'W and Z Bosons', 'W和Z玻色子发现', 'Discovery of W and Z bosons at CERN, confirming electroweak theory.', '在CERN发现W和Z玻色子，证实了电弱理论。', 1983, 'quantum'),
('top_quark', 'discovery', 'Top Quark Discovery', '顶夸克发现', 'Fermilab discovered the top quark, completing the third generation of quarks.', '费米实验室发现顶夸克，完成了第三代夸克。', 1995, 'quantum'),
('higgs_boson', 'discovery', 'Higgs Boson Discovery', '希格斯玻色子发现', 'CERN discovered the Higgs boson, confirming the mechanism that gives particles mass.', 'CERN发现希格斯玻色子，证实了赋予粒子质量的机制。', 2012, 'quantum'),
('gravitational_waves', 'discovery', 'Gravitational Waves Detection', '引力波探测', 'LIGO detected gravitational waves from merging black holes, confirming Einstein''s prediction.', 'LIGO探测到来自合并黑洞的引力波，证实了爱因斯坦的预言。', 2015, 'relativity'),
('black_hole_image', 'discovery', 'First Black Hole Image', '首张黑洞照片', 'Event Horizon Telescope captured the first image of a black hole in galaxy M87.', '事件视界望远镜拍摄到M87星系中黑洞的首张照片。', 2019, 'relativity'),
('bose_einstein_condensate', 'discovery', 'Bose-Einstein Condensate', '玻色-爱因斯坦凝聚态', 'First creation of BEC in laboratory, a new state of matter predicted by Bose and Einstein.', '首次在实验室中创造BEC，玻色和爱因斯坦预言的新物质状态。', 1995, 'quantum');

-- ============================================
-- RELATIONSHIPS/EDGES (100+ entries)
-- ============================================

-- Scientist invented/discovered equations
INSERT INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('arch_buoy', 'archimedes_principle', 'archimedes', 'invented_by', 'Archimedes discovered the principle of buoyancy'),
('hook_spring', 'hooke_law', 'hooke', 'invented_by', 'Hooke formulated the law of elasticity'),
('newton_f1', 'newton_first_law', 'newton', 'invented_by', 'Newton formulated the first law of motion'),
('newton_f2', 'newton_second_law', 'newton', 'invented_by', 'Newton formulated the second law of motion'),
('newton_f3', 'newton_third_law', 'newton', 'invented_by', 'Newton formulated the third law of motion'),
('newton_grav', 'universal_gravitation', 'newton', 'invented_by', 'Newton discovered universal gravitation'),
('leibniz_ke', 'kinetic_energy', 'leibniz', 'invented_by', 'Leibniz introduced the concept of kinetic energy'),
('bernoulli_eq', 'bernoulli_equation', 'bernoulli_daniel', 'invented_by', 'Bernoulli formulated fluid dynamics equation'),
('kepler_law', 'kepler_third_law', 'kepler', 'invented_by', 'Kepler discovered laws of planetary motion'),
('carnot_eff', 'carnot_efficiency', 'carnot', 'invented_by', 'Carnot derived maximum heat engine efficiency'),
('clausius_entropy', 'second_law_entropy', 'clausius', 'invented_by', 'Clausius formulated the second law and entropy'),
('boltz_ent', 'boltzmann_entropy', 'boltzmann', 'invented_by', 'Boltzmann developed statistical entropy formula'),
('coulomb_force', 'coulomb_law', 'coulomb', 'invented_by', 'Coulomb discovered electrostatic force law'),
('ohm_resist', 'ohm_law', 'ohm', 'invented_by', 'Ohm discovered the relationship V=IR'),
('faraday_ind', 'faraday_induction', 'faraday', 'invented_by', 'Faraday discovered electromagnetic induction'),
('maxwell_eq', 'maxwell_equations', 'maxwell', 'invented_by', 'Maxwell unified electricity and magnetism'),
('lorentz_f', 'lorentz_force', 'lorentz', 'invented_by', 'Lorentz formulated force on charges in EM fields'),
('lorentz_tr', 'lorentz_transform', 'lorentz', 'invented_by', 'Lorentz developed coordinate transformations'),
('huygens_wave', 'wave_speed', 'huygens', 'invented_by', 'Huygens contributed to wave theory'),
('snell_refr', 'snell_law', 'alhazen', 'invented_by', 'Alhazen studied light refraction'),
('planck_quant', 'planck_relation', 'planck', 'invented_by', 'Planck introduced energy quantization'),
('einstein_emc', 'emc2', 'einstein', 'invented_by', 'Einstein derived mass-energy equivalence'),
('einstein_td', 'time_dilation', 'einstein', 'invented_by', 'Einstein predicted time dilation'),
('einstein_lc', 'length_contraction', 'einstein', 'invented_by', 'Einstein predicted length contraction'),
('einstein_gf', 'einstein_field', 'einstein', 'invented_by', 'Einstein formulated general relativity field equations'),
('debroglie_wl', 'de_broglie_wavelength', 'de_broglie', 'invented_by', 'de Broglie proposed matter waves'),
('schrod_eq', 'schrodinger_equation', 'schrodinger', 'invented_by', 'Schrödinger developed wave mechanics'),
('heisen_unc', 'heisenberg_uncertainty', 'heisenberg', 'invented_by', 'Heisenberg discovered uncertainty principle'),
('dirac_eq_inv', 'dirac_equation', 'dirac', 'invented_by', 'Dirac formulated relativistic electron equation'),
('pauli_excl', 'pauli_exclusion', 'pauli', 'invented_by', 'Pauli discovered exclusion principle');

-- Scientists influencing other scientists
INSERT INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('arch_galileo', 'archimedes', 'galileo', 'influenced', 'Archimedes work influenced Galileo'),
('copern_galileo', 'copernicus', 'galileo', 'influenced', 'Copernicus heliocentric model inspired Galileo'),
('copern_kepler', 'copernicus', 'kepler', 'influenced', 'Copernicus heliocentric model inspired Kepler'),
('galileo_newton', 'galileo', 'newton', 'influenced', 'Galileo kinematics influenced Newton'),
('kepler_newton', 'kepler', 'newton', 'influenced', 'Kepler planetary laws influenced Newton'),
('hooke_newton', 'hooke', 'newton', 'influenced', 'Hooke contributed to Newton gravity ideas'),
('newton_euler', 'newton', 'euler', 'influenced', 'Newton mechanics influenced Euler'),
('euler_lagrange', 'euler', 'lagrange', 'influenced', 'Euler work influenced Lagrangian mechanics'),
('lagrange_hamilton', 'lagrange', 'hamilton', 'influenced', 'Lagrangian mechanics led to Hamiltonian mechanics'),
('franklin_coulomb', 'franklin', 'coulomb', 'influenced', 'Franklin electricity work influenced Coulomb'),
('coulomb_ampere', 'coulomb', 'ampere', 'influenced', 'Coulomb electrostatics influenced Ampère'),
('volta_faraday', 'volta', 'faraday', 'influenced', 'Volta battery enabled Faraday experiments'),
('oersted_faraday', 'oersted', 'faraday', 'influenced', 'Oersted magnetic discovery inspired Faraday'),
('faraday_maxwell', 'faraday', 'maxwell', 'influenced', 'Faraday field concept inspired Maxwell equations'),
('maxwell_hertz', 'maxwell', 'hertz', 'influenced', 'Maxwell equations led Hertz to discover EM waves'),
('maxwell_lorentz', 'maxwell', 'lorentz', 'influenced', 'Maxwell equations influenced Lorentz'),
('maxwell_einstein', 'maxwell', 'einstein', 'influenced', 'Maxwell equations led to special relativity'),
('lorentz_einstein', 'lorentz', 'einstein', 'influenced', 'Lorentz transformations influenced Einstein'),
('carnot_clausius', 'carnot', 'clausius', 'influenced', 'Carnot cycle inspired Clausius thermodynamics'),
('joule_kelvin', 'joule', 'kelvin', 'influenced', 'Joule heat work influenced Kelvin'),
('clausius_boltzmann', 'clausius', 'boltzmann', 'influenced', 'Clausius entropy inspired statistical mechanics'),
('rontgen_becquerel', 'rontgen', 'becquerel', 'influenced', 'X-ray discovery inspired radioactivity search'),
('becquerel_curie', 'becquerel', 'curie_marie', 'influenced', 'Becquerel discovery led Curies to radioactivity'),
('curie_marie_rutherford', 'curie_marie', 'rutherford', 'influenced', 'Curie radioactivity work influenced Rutherford'),
('rutherford_bohr', 'rutherford', 'bohr', 'influenced', 'Rutherford nuclear model led to Bohr atom'),
('rutherford_chadwick', 'rutherford', 'chadwick', 'influenced', 'Rutherford mentored Chadwick'),
('planck_einstein_q', 'planck', 'einstein', 'influenced', 'Planck quantum inspired Einstein photoelectric'),
('einstein_bohr', 'einstein', 'bohr', 'influenced', 'Einstein photon concept influenced Bohr'),
('bohr_heisenberg', 'bohr', 'heisenberg', 'influenced', 'Bohr mentored Heisenberg in Copenhagen'),
('bohr_schrodinger', 'bohr', 'schrodinger', 'influenced', 'Bohr atom model inspired wave mechanics'),
('bohr_pauli', 'bohr', 'pauli', 'influenced', 'Bohr mentored Pauli'),
('debroglie_schrodinger', 'de_broglie', 'schrodinger', 'influenced', 'de Broglie waves led to Schrödinger equation'),
('heisenberg_dirac', 'heisenberg', 'dirac', 'influenced', 'Matrix mechanics influenced Dirac'),
('schrodinger_dirac', 'schrodinger', 'dirac', 'influenced', 'Wave mechanics led to Dirac equation'),
('dirac_feynman', 'dirac', 'feynman', 'influenced', 'Dirac QED influenced Feynman'),
('fermi_feynman', 'fermi', 'feynman', 'influenced', 'Fermi mentored Feynman on nuclear physics'),
('schwinger_gellmann', 'schwinger', 'gell_mann', 'influenced', 'QED influenced particle physics development'),
('gellmann_weinberg', 'gell_mann', 'weinberg', 'influenced', 'Quark model influenced Standard Model');

-- Scientists discovering concepts/discoveries
INSERT INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('newton_cm', 'newton', 'classical_mechanics', 'discovered', 'Newton founded classical mechanics'),
('carnot_thermo', 'carnot', 'thermodynamics', 'discovered', 'Carnot founded thermodynamics'),
('boltzmann_sm', 'boltzmann', 'statistical_mechanics', 'discovered', 'Boltzmann developed statistical mechanics'),
('maxwell_em', 'maxwell', 'electromagnetism', 'discovered', 'Maxwell unified electromagnetism'),
('huygens_wo', 'huygens', 'wave_optics', 'discovered', 'Huygens developed wave theory of light'),
('einstein_sr', 'einstein', 'special_relativity', 'discovered', 'Einstein developed special relativity'),
('einstein_gr', 'einstein', 'general_relativity', 'discovered', 'Einstein developed general relativity'),
('planck_qm', 'planck', 'quantum_mechanics', 'discovered', 'Planck originated quantum theory'),
('heisenberg_qm', 'heisenberg', 'quantum_mechanics', 'discovered', 'Heisenberg developed matrix mechanics'),
('schrodinger_qm', 'schrodinger', 'quantum_mechanics', 'discovered', 'Schrödinger developed wave mechanics'),
('rutherford_np', 'rutherford', 'nuclear_physics', 'discovered', 'Rutherford founded nuclear physics'),
('gellmann_pp', 'gell_mann', 'particle_physics', 'discovered', 'Gell-Mann developed quark model'),
('weinberg_sm', 'weinberg', 'standard_model', 'discovered', 'Weinberg contributed to Standard Model');

-- Scientists making discoveries
INSERT INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('arch_buoy_disc', 'buoyancy_discovery', 'archimedes', 'invented_by', 'Archimedes discovered buoyancy principle'),
('copern_helio', 'heliocentric_model', 'copernicus', 'invented_by', 'Copernicus proposed heliocentric model'),
('kepler_planet', 'planetary_motion', 'kepler', 'invented_by', 'Kepler discovered planetary motion laws'),
('faraday_em_ind', 'electromagnetic_induction', 'faraday', 'invented_by', 'Faraday discovered EM induction'),
('hertz_em_wave', 'electromagnetic_waves', 'hertz', 'invented_by', 'Hertz confirmed electromagnetic waves'),
('rontgen_xray', 'xray_discovery', 'rontgen', 'invented_by', 'Röntgen discovered X-rays'),
('becq_radio', 'radioactivity', 'becquerel', 'invented_by', 'Becquerel discovered radioactivity'),
('thomson_electron', 'electron_discovery', 'rutherford', 'invented_by', 'Thomson discovered the electron'),
('einstein_photo', 'photoelectric_effect', 'einstein', 'invented_by', 'Einstein explained photoelectric effect'),
('ruth_nucleus', 'atomic_nucleus', 'rutherford', 'invented_by', 'Rutherford discovered atomic nucleus'),
('ruth_proton', 'proton_discovery', 'rutherford', 'invented_by', 'Rutherford identified the proton'),
('chad_neutron', 'neutron_discovery', 'chadwick', 'invented_by', 'Chadwick discovered neutron'),
('debrog_wpd', 'wave_particle_duality', 'de_broglie', 'invented_by', 'de Broglie proposed wave-particle duality'),
('dirac_positron', 'positron_discovery', 'dirac', 'invented_by', 'Dirac predicted, Anderson discovered positron'),
('fermi_fission', 'nuclear_fission', 'fermi', 'invented_by', 'Fermi contributed to nuclear fission understanding'),
('gellm_quark', 'quark_discovery', 'gell_mann', 'invented_by', 'Gell-Mann proposed quarks'),
('higgs_boson_disc', 'higgs_boson', 'higgs', 'invented_by', 'Higgs predicted the Higgs boson'),
('einstein_grav_wave', 'gravitational_waves', 'einstein', 'invented_by', 'Einstein predicted gravitational waves'),
('hawking_bh', 'black_hole_image', 'hawking', 'influenced', 'Hawking work on black holes');

-- Concept relationships
INSERT INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('cm_to_thermo', 'classical_mechanics', 'thermodynamics', 'leads_to', 'Mechanical energy concepts led to thermodynamics'),
('thermo_to_stat', 'thermodynamics', 'statistical_mechanics', 'leads_to', 'Thermodynamics led to statistical mechanics'),
('em_to_optics', 'electromagnetism', 'wave_optics', 'leads_to', 'EM theory unified with optics'),
('cm_to_sr', 'classical_mechanics', 'special_relativity', 'leads_to', 'CM limitations led to relativity'),
('em_to_sr', 'electromagnetism', 'special_relativity', 'leads_to', 'Maxwell equations led to special relativity'),
('sr_to_gr', 'special_relativity', 'general_relativity', 'leads_to', 'Special relativity extended to general'),
('cm_to_qm', 'classical_mechanics', 'quantum_mechanics', 'leads_to', 'Classical failures led to quantum mechanics'),
('qm_to_qft', 'quantum_mechanics', 'quantum_field_theory', 'leads_to', 'QM combined with SR gives QFT'),
('sr_to_qft', 'special_relativity', 'quantum_field_theory', 'leads_to', 'SR combined with QM gives QFT'),
('np_to_pp', 'nuclear_physics', 'particle_physics', 'leads_to', 'Nuclear studies led to particle physics'),
('qft_to_sm', 'quantum_field_theory', 'standard_model', 'leads_to', 'QFT underlies Standard Model'),
('pp_to_sm', 'particle_physics', 'standard_model', 'leads_to', 'Particle discoveries built Standard Model');

-- Discoveries part of concepts
INSERT INTO kg_edges (id, source_id, target_id, relationship, description) VALUES
('photo_qm', 'photoelectric_effect', 'quantum_mechanics', 'part_of', 'Photoelectric effect evidence for quantum'),
('wpd_qm', 'wave_particle_duality', 'quantum_mechanics', 'part_of', 'Wave-particle duality fundamental to QM'),
('radio_np', 'radioactivity', 'nuclear_physics', 'part_of', 'Radioactivity part of nuclear physics'),
('fission_np', 'nuclear_fission', 'nuclear_physics', 'part_of', 'Fission is nuclear physics'),
('fusion_np', 'nuclear_fusion', 'nuclear_physics', 'part_of', 'Fusion is nuclear physics'),
('quark_sm', 'quark_discovery', 'standard_model', 'part_of', 'Quarks are in Standard Model'),
('higgs_sm', 'higgs_boson', 'standard_model', 'part_of', 'Higgs boson completes Standard Model'),
('grav_wave_gr', 'gravitational_waves', 'general_relativity', 'part_of', 'Gravitational waves predicted by GR'),
('bh_gr', 'black_hole_image', 'general_relativity', 'part_of', 'Black holes predicted by GR'),
('cmb_cosmo', 'cmb_discovery', 'astrophysics', 'part_of', 'CMB crucial evidence for cosmology');







