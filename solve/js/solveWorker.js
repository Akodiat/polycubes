importScripts(
    '../../js/libs/minisat.js',
    '../../js/libs/three.min.js',
    '../../js/libs/randomColor.min.js',
    '../../js/utils.js',
    '../../js/polycubeSystem.js',
    './polycubeSolver.js'
);

onmessage = function(e) {
    postMessage(find_solution(...e.data));
}