/**
 * Math Graph Renderer using JSXGraph
 * Renders coordinate graphs, function plots, and geometric figures
 * for HKDSE Mathematics questions
 */

// Default colors for graph elements
const GRAPH_COLORS = {
  primary: '#3498db',
  secondary: '#e74c3c',
  accent: '#2ecc71',
  warning: '#f39c12',
  purple: '#9b59b6',
  teal: '#1abc9c',
  pink: '#e91e63',
  orange: '#ff5722'
};

// Default graph settings
const DEFAULT_SETTINGS = {
  boundingBox: [-10, 10, 10, -10],
  showGrid: true,
  showAxis: true,
  keepAspectRatio: true
};

/**
 * Create a graph container element
 * @param {string} containerId - The ID for the container
 * @returns {HTMLElement} The container element
 */
function createGraphContainer(containerId) {
  const container = document.createElement('div');
  container.id = containerId;
  container.className = 'math-graph-container';
  container.style.cssText = `
    width: 100%;
    max-width: 400px;
    height: 300px;
    margin: 16px auto;
    border: 1px solid var(--border, #e0e0e0);
    border-radius: 12px;
    background: #fafafa;
    overflow: hidden;
  `;
  return container;
}

/**
 * Parse equation string for JSXGraph function plotting
 * @param {string} equation - Math equation like "x^2", "sin(x)", "2*x+1"
 * @returns {Function} A function that evaluates the equation
 */
function parseEquation(equation) {
  // Replace common math notation with JavaScript
  let jsEquation = equation
    .replace(/\^/g, '**')
    .replace(/sin/g, 'Math.sin')
    .replace(/cos/g, 'Math.cos')
    .replace(/tan/g, 'Math.tan')
    .replace(/sqrt/g, 'Math.sqrt')
    .replace(/abs/g, 'Math.abs')
    .replace(/log/g, 'Math.log')
    .replace(/ln/g, 'Math.log')
    .replace(/exp/g, 'Math.exp')
    .replace(/pi/gi, 'Math.PI')
    .replace(/e(?![a-z])/gi, 'Math.E');
  
  try {
    // Create function from equation string
    return new Function('x', `return ${jsEquation};`);
  } catch (e) {
    console.error('Failed to parse equation:', equation, e);
    return (x) => x; // Fallback to y = x
  }
}

/**
 * Render a math graph using JSXGraph
 * @param {string} containerId - The ID of the container element
 * @param {Object} graphData - The graph configuration object
 * @returns {Object|null} The JSXGraph board object or null if failed
 */
function renderMathGraph(containerId, graphData) {
  if (!graphData || !window.JXG) {
    console.warn('JSXGraph not loaded or no graphData provided');
    return null;
  }

  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Container not found:', containerId);
    return null;
  }

  // Merge with defaults
  const settings = {
    ...DEFAULT_SETTINGS,
    ...graphData
  };

  // Initialize JSXGraph board
  const board = JXG.JSXGraph.initBoard(containerId, {
    boundingbox: settings.boundingBox,
    axis: settings.showAxis,
    grid: settings.showGrid,
    keepaspectratio: settings.keepAspectRatio,
    showNavigation: false,
    showCopyright: false,
    pan: { enabled: true },
    zoom: { enabled: true, wheel: true }
  });

  // Render each element
  if (graphData.elements && Array.isArray(graphData.elements)) {
    graphData.elements.forEach((element, index) => {
      try {
        renderElement(board, element, index);
      } catch (e) {
        console.error('Failed to render element:', element, e);
      }
    });
  }

  return board;
}

/**
 * Render a single graph element
 * @param {Object} board - The JSXGraph board
 * @param {Object} element - The element configuration
 * @param {number} index - Element index for unique naming
 */
function renderElement(board, element, index) {
  const color = element.color || GRAPH_COLORS.primary;
  const label = element.label || '';

  switch (element.type) {
    case 'point':
      renderPoint(board, element, color);
      break;
    
    case 'line':
      renderLine(board, element, color);
      break;
    
    case 'segment':
      renderSegment(board, element, color);
      break;
    
    case 'circle':
      renderCircle(board, element, color);
      break;
    
    case 'curve':
    case 'function':
      renderCurve(board, element, color);
      break;
    
    case 'polygon':
      renderPolygon(board, element, color);
      break;
    
    case 'angle':
      renderAngle(board, element, color);
      break;
    
    case 'vector':
      renderVector(board, element, color);
      break;
    
    case 'parabola':
      renderParabola(board, element, color);
      break;
    
    case 'ellipse':
      renderEllipse(board, element, color);
      break;

    case 'text':
      renderText(board, element, color);
      break;

    default:
      console.warn('Unknown element type:', element.type);
  }
}

/**
 * Render a point
 */
function renderPoint(board, element, color) {
  const [x, y] = element.coords || [0, 0];
  board.create('point', [x, y], {
    name: element.label || '',
    size: 4,
    color: color,
    fixed: true,
    label: {
      offset: [10, 10],
      fontSize: 14,
      color: color
    }
  });
}

/**
 * Render a line (infinite)
 */
function renderLine(board, element, color) {
  if (element.points && element.points.length >= 2) {
    const [[x1, y1], [x2, y2]] = element.points;
    const p1 = board.create('point', [x1, y1], { visible: false });
    const p2 = board.create('point', [x2, y2], { visible: false });
    board.create('line', [p1, p2], {
      strokeColor: color,
      strokeWidth: 2,
      straightFirst: true,
      straightLast: true
    });
  } else if (element.equation) {
    // Support line equation like "2x + 3y = 6"
    // For now, use slope-intercept form: slope and yIntercept
    const slope = element.slope ?? 1;
    const yIntercept = element.yIntercept ?? 0;
    board.create('functiongraph', [(x) => slope * x + yIntercept], {
      strokeColor: color,
      strokeWidth: 2
    });
  }
}

/**
 * Render a line segment
 */
function renderSegment(board, element, color) {
  if (element.points && element.points.length >= 2) {
    const [[x1, y1], [x2, y2]] = element.points;
    const p1 = board.create('point', [x1, y1], { 
      visible: !!element.showEndpoints, 
      name: element.labels?.[0] || '',
      color: color
    });
    const p2 = board.create('point', [x2, y2], { 
      visible: !!element.showEndpoints, 
      name: element.labels?.[1] || '',
      color: color
    });
    board.create('segment', [p1, p2], {
      strokeColor: color,
      strokeWidth: 2
    });
  }
}

/**
 * Render a circle
 */
function renderCircle(board, element, color) {
  const [cx, cy] = element.center || [0, 0];
  const radius = element.radius || 1;
  
  const center = board.create('point', [cx, cy], { 
    visible: !!element.showCenter,
    name: element.centerLabel || '',
    color: color
  });
  
  board.create('circle', [center, radius], {
    strokeColor: color,
    strokeWidth: 2,
    fillColor: element.fill ? color : 'none',
    fillOpacity: 0.1
  });
}

/**
 * Render a curve/function
 */
function renderCurve(board, element, color) {
  const equation = element.equation || 'x';
  const domain = element.domain || [-10, 10];
  const fn = parseEquation(equation);
  
  board.create('functiongraph', [fn, domain[0], domain[1]], {
    strokeColor: color,
    strokeWidth: 2
  });
}

/**
 * Render a polygon
 */
function renderPolygon(board, element, color) {
  if (element.vertices && element.vertices.length >= 3) {
    const points = element.vertices.map((v, i) => {
      return board.create('point', v, {
        name: element.labels?.[i] || '',
        color: color,
        size: 3,
        label: {
          offset: [10, 10],
          fontSize: 14,
          color: color
        }
      });
    });
    
    board.create('polygon', points, {
      borders: {
        strokeColor: color,
        strokeWidth: 2
      },
      fillColor: element.fill ? color : 'none',
      fillOpacity: 0.1
    });
  }
}

/**
 * Render an angle marker
 */
function renderAngle(board, element, color) {
  if (element.points && element.points.length >= 3) {
    const [[x1, y1], [x2, y2], [x3, y3]] = element.points;
    const p1 = board.create('point', [x1, y1], { visible: false });
    const p2 = board.create('point', [x2, y2], { visible: false }); // vertex
    const p3 = board.create('point', [x3, y3], { visible: false });
    
    board.create('angle', [p1, p2, p3], {
      radius: element.radius || 1,
      name: element.label || '',
      color: color,
      fillColor: color,
      fillOpacity: 0.2
    });
  }
}

/**
 * Render a vector (arrow)
 */
function renderVector(board, element, color) {
  if (element.points && element.points.length >= 2) {
    const [[x1, y1], [x2, y2]] = element.points;
    const p1 = board.create('point', [x1, y1], { visible: false });
    const p2 = board.create('point', [x2, y2], { visible: false });
    
    board.create('arrow', [p1, p2], {
      strokeColor: color,
      strokeWidth: 2,
      lastArrow: { type: 2, size: 8 }
    });
  }
}

/**
 * Render a parabola
 */
function renderParabola(board, element, color) {
  const a = element.a ?? 1;
  const h = element.h ?? 0; // vertex x
  const k = element.k ?? 0; // vertex y
  const domain = element.domain || [-10, 10];
  
  // y = a(x-h)² + k
  const fn = (x) => a * Math.pow(x - h, 2) + k;
  
  board.create('functiongraph', [fn, domain[0], domain[1]], {
    strokeColor: color,
    strokeWidth: 2
  });
  
  // Show vertex if requested
  if (element.showVertex) {
    board.create('point', [h, k], {
      name: 'V',
      color: color,
      size: 4
    });
  }
}

/**
 * Render an ellipse
 */
function renderEllipse(board, element, color) {
  const [cx, cy] = element.center || [0, 0];
  const a = element.a || 2; // semi-major axis
  const b = element.b || 1; // semi-minor axis
  
  const center = board.create('point', [cx, cy], { visible: false });
  const f1 = board.create('point', [cx - Math.sqrt(a*a - b*b), cy], { visible: false });
  const f2 = board.create('point', [cx + Math.sqrt(a*a - b*b), cy], { visible: false });
  
  board.create('ellipse', [f1, f2, [cx, cy + b]], {
    strokeColor: color,
    strokeWidth: 2,
    fillColor: element.fill ? color : 'none',
    fillOpacity: 0.1
  });
}

/**
 * Render text annotation
 */
function renderText(board, element, color) {
  const [x, y] = element.coords || [0, 0];
  board.create('text', [x, y, element.text || ''], {
    fontSize: element.fontSize || 14,
    color: color
  });
}

/**
 * Destroy and clean up a graph
 * @param {string} containerId - The container ID
 */
function destroyMathGraph(containerId) {
  if (window.JXG && JXG.JSXGraph.freeBoard) {
    try {
      const board = JXG.JSXGraph.boards[containerId];
      if (board) {
        JXG.JSXGraph.freeBoard(board);
      }
    } catch (e) {
      console.warn('Error destroying graph:', e);
    }
  }
  
  // Clear container
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
  }
}

/**
 * Check if graphData is valid and should be rendered
 * @param {Object} graphData - The graph data object
 * @returns {boolean}
 */
function hasValidGraphData(graphData) {
  return graphData && 
         typeof graphData === 'object' && 
         graphData.elements && 
         Array.isArray(graphData.elements) && 
         graphData.elements.length > 0;
}

// Export functions for use in other scripts
window.MathGraph = {
  render: renderMathGraph,
  destroy: destroyMathGraph,
  createContainer: createGraphContainer,
  hasValidData: hasValidGraphData,
  COLORS: GRAPH_COLORS
};

