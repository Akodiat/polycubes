importScripts(
    '../../js/libs/minisat.js',
    '../../js/libs/three.min.js',
    '../../js/libs/randomColor.min.js',
    '../../js/utils.js',
    '../../js/polycubeSystem.js',
    './polycubeSolver.js'
);

onmessage = function(e) {
    const [topology, empty, nCubeTypes, nColors, nDim, tortionalPatches] = e.data;
    result = find_solution(topology, empty, nCubeTypes, nColors, nDim, tortionalPatches);
    postMessage(result);
}