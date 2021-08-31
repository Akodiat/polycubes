if (WEBGL.isWebGLAvailable() === false) {
    document.body.appendChild(WEBGL.getWebGLErrorMessage());
}

document.addEventListener("keydown", event => {
    if (event.key == 's' && event.ctrlKey) {
        event.preventDefault();
        system.getCoordinateFile();
    }
});

function getCoordinateFile() {
    let filename = `${system.getRuleStr()}.${system.cubeMap.size}-mer`;
    let text = ""
    system.cubeMap.forEach(function(value, key){text += key + '\n'});
    saveString(text, filename);
}

function exportGLTF(name='scene') {
    // Instantiate an exporter
    let exporter = new THREE.GLTFExporter();
    let options = {'forceIndices': true};

    // Parse the input and generate the glTF output
    exporter.parse(system.objGroup, function (result) {
        if (result instanceof ArrayBuffer) {
            saveArrayBuffer(result, 'scene.glb');
        } else {
            let output = JSON.stringify(result, null, 2);
            console.log(output);
            saveString(output, `${name}.gltf`);
        }
    }, options);
}

// Adapted from https://stackoverflow.com/a/41350703
 function getSpiralCoord(n) {
    const k = Math.ceil((Math.sqrt(n) - 1) / 2);
    let t = 2 * k + 1;
    let m = Math.pow(t, 2);

    t -= 1;

    if (n >= m - t) {
        return new THREE.Vector3(0, k - (m - n), -k);
    }

    m -= t;

    if (n >= m - t) {
        return new THREE.Vector3(0, -k, -k + (m - n));
    }

    m -= t;

    if (n >= m - t) {
        return new THREE.Vector3(0, -k + (m - n), k);
    }

    return new THREE.Vector3(0, k, k - (m - n - t));
}


function exportGLTFs(rules, padding=5, inclination=1, saveEvery=1000) {
    let zip = new JSZip();
    let savedCounter = 0;
    for (let i=0; i<rules.length; i++) {
        const rule = rules[i];
        console.log(`${i} (${Math.round(100*i/rules.length)}%)`);
        const system = new PolycubeSystem(parseHexRule(rule), new THREE.Scene(), 100, 100, "seeded");
        system.background = true;
        system.seed();
        while (!system.processMoves());

        system.objGroup.position.copy(getSpiralCoord(i+1));
        system.objGroup.position.x = inclination * i;
        system.objGroup.position.y *= padding;
        system.objGroup.position.z *= padding;
        //system.objGroup.position.y = Math.ceil(i / side) * padding;
        //system.objGroup.position.z = (i % side) * padding;
        system.objGroup.position.sub(system.centerOfMass);

        // Instantiate an exporter
        let exporter = new THREE.GLTFExporter();
        let options = {'forceIndices': true};

        // Parse the input and generate the glTF output
        exporter.parse(system.objGroup, function (result) {
            let output = JSON.stringify(result);
            zip.file(`${i}_${rule}.gltf`, output);

            if (i+1 % saveEvery == 0) {
                zip = new JSZip();
            }

            if (i == rules.length-1 || i+1 % saveEvery == 0) {
                zip.generateAsync({type:"blob"})
                .then(function(content) {
                    saveAs(content, `gltfs_${savedCounter++}.zip`); //FileSaver.js
                });
            }
        }, options);
    }
}

document.addEventListener("keydown", event => {
    if (event.key == 's' && event.ctrlKey) {
        event.preventDefault();
        system.getCoordinateFile();
    } else if (event.key == 'p') {
        saveCanvasImage();
    }
});

function saveCanvasImage(){
    canvas.toBlob(function(blob){
        var a = document.createElement('a');
        var url = URL.createObjectURL(blob);
        a.href = url;
        a.download = `${system.getRuleStr()}.png`;
        a.click();
    }, 'image/png', 1.0);
}

rulesToImage = [];
function getImagesFromRules(rules) {
    rulesToImage = rules;
    f = ()=>{
        saveCanvasImage();
        nextrule = rulesToImage.pop();
        if(nextrule){
            system.resetRule(parseHexRule(nextrule));
        }
    };
    window.addEventListener('movesProcessed', f, false);
    nextrule = rulesToImage.pop();
    system.resetRule(parseHexRule(nextrule));
}

function toggleModal(id) {
    let modal = document.getElementById(id);
    modal.classList.toggle("show-modal");
}

// From: https://html-online.com/articles/get-url-parameters-javascript/
function getUrlVars() {
    let vars = {};
    let parts = window.location.href.replace(
        /[?&]+([^=&]+)=([^&]*)/gi, 
        function(m,key,value) {vars[key] = value;}
    );
    return vars;
}

function getUrlParam(param, defaultVal) {
    let vars = getUrlVars();
    return param in vars ? vars[param] : defaultVal;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}

// From https://github.com/mrdoob/three.js/pull/14526#issuecomment-497254491
function fitCamera(nSteps) {
    nSteps = nSteps || 20;
    const fitOffset = 1.3;
    const box = new THREE.Box3();
    box.expandByObject(system.objGroup);
    const size = box.getSize(new THREE.Vector3()).addScalar(1.5);
    const center = system.centerOfMass; //box.getCenter(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const fitHeightDistance = maxSize / (2 * Math.atan(Math.PI * camera.fov / 360));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const distance = fitOffset * Math.max(fitHeightDistance, fitWidthDistance);
    const direction = orbit.target.clone().sub(camera.position).normalize().multiplyScalar(distance);
    orbit.maxDistance = distance * 10;
    camera.near = distance / 100;
    camera.far = distance * 100;
    let targetPos = orbit.target.clone().sub(direction);

    let i = 1;
    let zoomOut = function() {
        camera.position.lerp(targetPos, Math.pow(i/nSteps,2));

        let curr = camera.quaternion.clone();
        camera.lookAt(system.centerOfMass);
        let target = camera.quaternion.clone();
        camera.quaternion.copy(curr);
        camera.quaternion.slerp(target, i/nSteps)

        render();
        if(i < nSteps) {
            i++;
            requestAnimationFrame(zoomOut.bind(this));
        } else {
            orbit.target.copy(center);
        }
    }
    zoomOut();

}

// Regenerate when there are no more cubes to add
window.addEventListener('movesProcessed', function(e) {
    fitCamera();
}, false);

function toggleFog(density=0.08) {
    if (!scene.fog || scene.fog.density != density) {
        scene.fog = new THREE.FogExp2(0xffffff, density);
    } else {
        scene.fog = undefined;
    }
    render();
}

function switchCamera() {
    if (camera instanceof THREE.PerspectiveCamera) {
        //get camera parameters
        const far = camera.far;
        const near = camera.near;
        const focus = orbit.target;
        const fov = camera.fov * Math.PI / 180; //convert to radians
        const pos = camera.position;
        let width = 2 * Math.tan(fov / 2) * focus.distanceTo(pos);
        let height = width / camera.aspect;
        const up = camera.up;
        const quat = camera.quaternion;
        let cameraHeading = new THREE.Vector3(0, 0, -1);
        cameraHeading.applyQuaternion(quat);
        //if the camera is upside down, you need to flip the corners of the orthographic box
        /*
        if (quat.dot(refQ) < 0 && quat.w > 0) {
            width *= -1;
            height *= -1;
        }
        */
        //create a new camera with same properties as old one
        const newCam = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, near, far);
        camera.position.clone(pos);
        newCam.up = up;
        newCam.lookAt(focus);
        camera.children.forEach(c => {
            newCam.add(c);
        });
        scene.remove(camera);
        camera = newCam;
        orbit.object = camera;
        scene.add(camera);
    }
    else if (camera instanceof THREE.OrthographicCamera) {
        //get camera parameters
        const far = camera.far;
        const near = camera.near;
        const focus = orbit.target;
        const pos = camera.position;
        const up = camera.up;
        let fov = 2 * Math.atan((((camera.right - camera.left) / 2)) / focus.distanceTo(pos)) * 180 / Math.PI;
        //if the camera is upside down, you need to flip the fov for the perspective camera
        if (camera.left > camera.right) {
            fov *= -1;
        }
        //create a new camera with same properties as old one
        let newCam = createPerspectiveCamera(fov, near, far, pos.toArray());
        newCam.up = up;
        newCam.lookAt(focus);
        let light = pointlight;
        scene.remove(camera);
        camera = newCam;
        orbit.object = camera;
        camera.add(light);
        scene.add(camera);
        document.getElementById("cameraSwitch").innerHTML = "Orthographic";
    }
    render();
}


function render() {
    renderer.render(scene, camera);
}

function initScene() {
    camera = new THREE.PerspectiveCamera(
        45, window.innerWidth / window.innerHeight,
        1, 10000);
    camera.position.set(5, 8, 13);
    camera.lookAt(0, 0, 0);

    scene = new THREE.Scene();

    // lights
    let ambientLight = new THREE.AmbientLight(0x707070);
    camera.add(ambientLight);

    let directionalLight = new THREE.PointLight(0x707070);
    directionalLight.position.set(10, 10, 5).normalize();
    camera.add(directionalLight);

    scene.add(camera);

    canvas = document.getElementById("threeCanvas");
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas: canvas,
        alpha: true,
        preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize, false);

    // orbit controls

    orbit = new THREE.OrbitControls(camera, canvas);
    orbit.damping = 0.2;
    orbit.addEventListener('change', render);
}

let camera, orbit, scene, renderer, canvas;
let plane;
let mouse, raycaster;
let rollOverMesh, rollOverMaterial;

//let objects = [];

initScene();


