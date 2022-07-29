import utils
import json
from polycubeSolver import polysat
import random
import pickle

def sampleClauses(solveSpecPath, nSamples=5, preview=False, outdir='../../../'):
    name = solveSpecPath.split('/')[-1].split('.')[0]

    with open(solveSpecPath, 'r') as f:
        data = f.read()
    solveSpec = json.loads(data)
    
    maxNT, maxNC = utils.countParticlesAndBindings(solveSpec['bindings'])

    for _ in range(nSamples):
        nCubeTypes = random.randint(round(0.05 * maxNT), round(0.2 * maxNT))
        nColors = random.randint(1, min(nCubeTypes * 6, maxNC))

        outPath = outdir+'{}t_{}c_{}_noAllnoEmpty.cnf'.format(
            nCubeTypes, nColors, name
        )
        if not preview:
            mysat = polysat(
                solveSpec['bindings'],
                nCubeTypes,
                nColors,
                solveSpec['nDim'],
                solveSpec['torsion'],
                allParticles = False,
                allPatches = False,
                forbidEmptySpecies = True
            )
            
            mysat.dump_cnf_to_file(outPath)

            with open(outPath+'.variables.pickle','wb') as f:
                pickle.dump(mysat.variables, f)
                                   
        print('Saved to {}'.format(outPath))

sampleClauses('../shapes/scaling/cube5.json', 10)
sampleClauses('../shapes/scaling/cube6.json', 10)
sampleClauses('../shapes/scaling/cube7.json', 1)

