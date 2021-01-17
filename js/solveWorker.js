importScripts('libs/minisat.js', 'libs/three.min.js', 'libs/randomColor.min.js', 'polycubeSystem.js', 'polycubeSolver.js');

onmessage = function(e) {
    console.log('Message received from main script');
    [topology, empty, nCubeTypes, nColors, nDim, tortionalPatches] = e.data;

    result = find_solution(topology, empty, nCubeTypes, nColors, nDim, tortionalPatches);
    console.log('Posting message back to main script: '+result);
    postMessage(result);
}