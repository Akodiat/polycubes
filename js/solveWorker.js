importScripts('libs/minisat.js', 'libs/three.min.js', 'libs/randomColor.min.js', 'polycubeSystem.js', 'polycubeSolver.js');

onmessage = function(e) {
    console.log('Message received from main script');
    [coords, nCubeTypes, nColors, nDim, tortionalPatches] = e.data;

    // Make sure coords have the right type:
    coords = coords.map(c=>new THREE.Vector3().copy(c))

    result = find_solution(coords, nCubeTypes, nColors, nDim, tortionalPatches);
    console.log('Posting message back to main script: '+result);
    postMessage(result);
}