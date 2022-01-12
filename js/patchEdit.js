
transform = new THREE.TransformControls(camera, canvas);
transform.setSpace('local');
transform.addEventListener('change', ()=>{
    render();
});

transform.addEventListener('dragging-changed', event=>{
    orbit.enabled = !event.value;
    if (!event.value) {
        transform.object.patch.update(undefined, transform.object.position, transform.object.quaternion);
        system.regenerate();
        clearRules();
    }
});

scene.add(transform);

raycaster = new THREE.Raycaster();
mouse = new THREE.Vector2()
function onMouseMove(event) {
	mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    window.requestAnimationFrame(rayrender);
}

const hoverscale = 1.2;

function rayrender() {
	// update the picking ray with the camera and mouse position
	raycaster.setFromCamera( mouse, camera );

    if (orbit.enabled) {
        // calculate objects intersecting the picking ray
        const intersects = raycaster.intersectObjects(system.patchObjects, true);

        if (intersects.length > 0) {
            let patchGroup = intersects[0].object.parent;

            if (transform.object) {
                transform.object.children.forEach(c=>{
                    c.scale.divideScalar(hoverscale);
                });
            }

            transform.attach(patchGroup);

            patchGroup.children.forEach(c=>{
                c.scale.multiplyScalar(hoverscale);
            });
        }
    }

	renderer.render( scene, camera );
}

window.addEventListener('mousedown', ()=>{
    if (orbit.enabled && transform.object) {
        transform.object.children.forEach(c=>{
            c.scale.divideScalar(hoverscale);
        });
        transform.detach();
    }
}, false)

window.addEventListener( 'mousemove', onMouseMove, false );

window.addEventListener('keydown', event=>{

    console.log(event.key)

    switch (event.key) {

        case 'q':
            transform.setSpace(transform.space === 'local' ? 'world' : 'local');
            break;

        case 'Shift':
            transform.setTranslationSnap(100);
            transform.setRotationSnap(THREE.MathUtils.degToRad(15));
            break;

        case 't':
            transform.setMode('translate');
            break;

        case 'r':
            transform.setMode('rotate');
            break;

        case 'c':
            const position = camera.position.clone();

            camera = camera.isPerspectiveCamera ? cameraOrtho : cameraPersp;
            camera.position.copy(position);

            orbit.object = camera;
            transform.camera = camera;

            camera.lookAt(orbit.target.x, orbit.target.y, orbit.target.z);
            onWindowResize();
            break;

        case 'v':
            const randomFoV = Math.random() + 0.1;
            const randomZoom = Math.random() + 0.1;

            cameraPersp.fov = randomFoV * 160;
            cameraOrtho.bottom = -randomFoV * 5;
            cameraOrtho.top = randomFoV * 5;

            cameraPersp.zoom = randomZoom * 5;
            cameraOrtho.zoom = randomZoom * 5;
            onWindowResize();
            break;

        case '+':
            transform.setSize(transform.size + 0.1);
            break;

        case '-':
            transform.setSize(Math.max(transform.size - 0.1, 0.1));
            break;

        case 'x':
            transform.showX = !transform.showX;
            break;

        case 'y':
            transform.showY = !transform.showY;
            break;

        case 'z':
            transform.showZ = !transform.showZ;
            break;

        case ' ':
            transform.enabled = !transform.enabled;
            break;

        case 'Escape':
            transform.reset();
            break;
    }
});

window.addEventListener('keyup', event=>{
    if (event.shiftKey) {
        transform.setTranslationSnap(null);
        transform.setRotationSnap(null);
        transform.setScaleSnap(null);
    }
});