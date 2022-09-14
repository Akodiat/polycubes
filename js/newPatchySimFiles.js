function generateNewPatchyInput(
    oxDNA_dir,
    topFileName = 'LORO.topology.top',
    temperature="[template]",
) {
    return `
##############################
####  PROGRAM PARAMETERS  ####
#############################
backend = CPU
CUDA_list = verlet
#backend_precision = double
#debug = 1
#seed = 4982

DPS_KF_cosmax = 0.7
DPS_KF_delta = 0.2
DPS_patch_power = 20
##############################
####    SIM PARAMETERS    ####
##############################
sim_type = MD
ensemble = NVT

newtonian_steps = 53 #103
diff_coeff = 1.00
#pt = 0.1
thermostat = brownian

box_type = cubic
cells_auto_optimisation = false
energy_threshold=0.5
max_density_multiplier = 10

use_barostat = false
barostat_probability = 0.1
P = 0
delta_L = 0.1

T = ${temperature}
dt = 0.002
verlet_skin = 0.2

steps = 1e10
check_energy_every = 10000
check_energy_threshold = 1.e-4

interaction_type = DetailedPatchySwapInteraction
DPS_lambda = 0
DPS_interaction_matrix_file = LORO.interaction_matrix.txt
DPS_is_KF = 0
DPS_alpha = 0.12

##############################
####    INPUT / OUTPUT    ####
##############################
topology = ${topFileName}
conf_file = init.conf
trajectory_file = trajectory.dat
refresh_vel = true
log_file = log.dat
#no_stdout_energy = 1
restart_step_counter = true
energy_file = energy.dat
print_conf_interval = 1e6
#print_conf_ppc = 51
print_energy_every = 1e5
time_scale = linear

plugin_search_path = ${oxDNA_dir}/contrib/rovigatti/

data_output_1 = {
        name = bonds.dat
        only_last = false
        print_every = 1e5
        col_1 = {
            id = my_patchy_bonds
            type = PatchyBonds
            print_bonds = true
        }
}
`
}

function generateLoroConf(rule, assemblyMode='seeded', scale=1.4) {
    let sys = new PolycubeSystem(rule, undefined, 100, 100, assemblyMode, true);
    sys.seed();
    let processed = false;
    while (!processed) {
        processed = sys.processMoves();
        if (processed == 'oub') {
            console.warn("Getting config for unbounded rule");
            break;
        }
    }
    let conf = [];
    let nParticles = 0;
    let max = new THREE.Vector3();
    let min = new THREE.Vector3();
    let mean = new THREE.Vector3();
    for (const [key, c] of sys.confMap) {
        const p = sys.cubeMap.get(key);
        for (let i=0; i<3; i++) {
            max.setComponent(i, Math.max(max.getComponent(i), p.getComponent(i)));
            min.setComponent(i, Math.min(min.getComponent(i), p.getComponent(i)));
        }
        mean.add(p);
        nParticles++;
    }
    let box = max.clone().sub(min).multiplyScalar(3*scale);
    mean.divideScalar(nParticles).multiplyScalar(scale);

    for (const [key, c] of sys.confMap) {
        const p = sys.cubeMap.get(key).clone().multiplyScalar(scale).sub(mean).add(box.clone().divideScalar(2));
        const a1 = new THREE.Vector3(1, 0, 0).applyQuaternion(c.q);
        const a3 = new THREE.Vector3(0, 0, 1).applyQuaternion(c.q);
        const vF = (v) => v.toArray().map(
            n=>Math.round(n*100)/100 // Round to 2 decimal places
        ).join(' ');
        conf.push({
            'species': c.ruleIdx,
            'conf': `${vF(p)} ${vF(a1)} ${vF(a3)} 0 0 0 0 0 0`
        });
    }
    conf.sort((a,b)=>a['species'] - b['species']);
    // It is safer to have a cubic box.
    // Also make sure to round it and have it at least 10
    let boxSide = Math.ceil(Math.max(10, ...box.toArray()));
    let confStr = `t = 0\nb = ${[boxSide, boxSide, boxSide].join(' ')}\nE = 0 0 0\n` + 
        conf.map(c=>c['conf']).join('\n');
    return confStr;
}

function getNewPatchySimFiles({rule=system.rule, nAssemblies=1, name='sim',
    oxDNA_dir = '/users/joakim/repo/oxDNA',
    temperatures = ['0.01'],
    confDensity = 0.2,
    multifarious = false
}={}) {
    let zip = new JSZip();

    const cubeTypeCount = multifarious ? getCubeTypeCount(rule, 'stochastic', 1000) : getCubeTypeCount(rule);

    let confStr;
    const topFileName = 'LORO.topology.top';
    const confFileName = 'init.conf';
    const particleRadius = 0.5

    let patchCounter = 0;
    let totalCount = 0;
    let interactionMap = new Map();
    let top = rule.map((s,i)=>{
        let count = nAssemblies*cubeTypeCount[i];
        totalCount += count
        patchIds=[];
		patchSpecs=[]
        s.forEach((f,j)=>{
            if(f.color!=0){
                const patchId = patchCounter++;
                patchIds.push(patchId)
				patchSpecs.push(
                    ruleOrder[j].clone().multiplyScalar(
                        particleRadius
                    ).toArray().join(' ')
                );
                if (!interactionMap.has(f.color)) {
                    interactionMap.set(f.color, [])
                }
                interactionMap.get(f.color).push(patchId)
            }
        });
        return [`${count} ${patchIds.length} ${patchIds}`, patchSpecs.join('\n')]
    });
    patchSpecFiles = new Map()
    let topStr = `${totalCount} ${cubeTypeCount.length}`
    top.forEach((s,i)=>{
        const patchSpecFile = `s${i}.patchspec`;
        topStr += '\n';
        topStr += s[0];
        topStr += " " + patchSpecFile;
        patchSpecFiles.set(patchSpecFile, s[1]);
    })
    if (nAssemblies == 1) {
        confStr = generateLoroConf(rule, assemblyMode);
    }

    let interactionMatrix = [];
    interactionMap.forEach((patchesA, colorA)=>{
        interactionMap.forEach((patchesB, colorB)=>{
            if (colorA == -colorB) {
                patchesA.forEach(patchA=>{
                    patchesB.forEach(patchB=>{
                        interactionMatrix.push(`patchy_eps[${patchA}][${patchB}] = 1`);
                    });
                });
            }
        })
    });

    const inputFileName = 'input';
    let confGenStr = `${oxDNA_dir}/build/bin/confGenerator ${inputFileName} ${confDensity}`;

    for (const temperature of temperatures) {
        let folder = zip.folder(`T_${temperature}`);

        let inputStr = generateNewPatchyInput(oxDNA_dir, topFileName, temperature);

        let simulateStr = `addqueue -c "${name} T=${temperature} - 1 week" ${oxDNA_dir}/build/bin/oxDNA ${inputFileName}`;

        let submit_slurmStr = `#!/bin/bash
#SBATCH -p sulccpu1
#SBATCH -q wildfire
#SBATCH -n 1                    # number of cores
#SBATCH -t 8-00:00              # wall time (D-HH:MM)
#SBATCH --job-name="${name}_T${temperature}"

module add gcc/8.4.0                                        # and the required C compiler \ lib

${oxDNA_dir}/build/bin/oxDNA ${inputFileName}`

        folder.file(topFileName, topStr);
        folder.file(inputFileName, inputStr);
        folder.file('generateConf.sh', confGenStr);
        folder.file('simulate.sh', simulateStr);
        folder.file('submit_slurm.sh', submit_slurmStr);
        folder.file('LORO.interaction_matrix.txt', interactionMatrix.join('\n'));

        patchSpecFiles.forEach((patchStr, patchFileName)=>
            folder.file(patchFileName, patchStr)
        )

        if (confStr) {
            folder.file(confFileName, confStr);
        }
    }

    zip.file(
        'simulateAll.sh', `
for var in */nt*/T_*
do
    cd $var
    bash generateConf.sh
    bash simulate.sh
    cd ../../..
done`
    );

    let complClusters = cubeTypeCount.flatMap((n,idx) => {
        let cluster = [];
        for (let i=0; i<n; i++) {
            cluster.push(idx)
        }
        return cluster;
    });

    zip.file('data.py',
`completeCluster = [${complClusters}]
rule = '${ruleToDec(rule)}'`
    )

    zip.generateAsync({type:"blob"})
    .then(function(content) {
        saveAs(content, `${name}.zip`); //FileSaver.js
    });
}
