import utils
import polycubes
import numpy as np
import pandas as pd
import os
import random
import pickle
import glob
from multiprocessing import Pool

# Enumerate all genotypes one point mutation away
def enumerateMutations(hexRule, nColors=31, nCubeTypes=5, dim=3):
    emptyCube = "000000000000"
    orientations = range(4)
    colors = range(-nColors, nColors+1)

    # Pad with empty cubes until max length
    while len(hexRule) < nCubeTypes * len(emptyCube):
        hexRule += emptyCube

    mutations = []
    rule = utils.parseHexRule(hexRule)
    # For all cube types
    for i, cube in enumerate(rule):
        # For all patches
        for j, face in enumerate(cube):
            # For all other colors
            for color in colors:
                if color != face['color']:
                    newRule = utils.parseHexRule(hexRule)
                    newRule[i][j]['color'] = color
                    newHexRule = utils.ruleToHex(newRule)
                    assert(len(newHexRule) == nCubeTypes * len(emptyCube))
                    mutations.append(newHexRule)
            if dim == 3 and face['color'] != 0:
                # For all other orientations:
                for orientation in orientations:
                    if orientation != face['orientation']:
                        newRule = utils.parseHexRule(hexRule)
                        newRule[i][j]['orientation'] = orientation
                        mutations.append(utils.ruleToHex(newRule))
    return mutations

# Calculate the fraction of mutational neigbours that produce the same phenotype
def calcGenotypeRobustness(hexRule, nColors=31, nCubeTypes=5, dim=3, assemblyMode='stochastic', radius=1):
    mutations = {hexRule}
    for _ in range(radius):
        mutations.update({y for x in (enumerateMutations(r, nColors, nCubeTypes, dim) for r in mutations) for y in x})
    nEqual = sum(polycubes.checkEquality(hexRule, mutant, assemblyMode) for mutant in mutations)
    return nEqual / len(mutations)

def calcPhenotypeRobustness(pheno, nColors=31, nCubeTypes=5, dim=3, assemblyMode='stochastic', samplesPerPheno=100, radius=1):
    r = dict(pheno)
    sample = random.sample(r['genotypes'], min(samplesPerPheno, r['count']))
    robustnessVals = [calcGenotypeRobustness(
        hexRule, nColors, nCubeTypes, dim, assemblyMode, radius
    ) for hexRule in sample]
    r['robustness'] = np.mean(robustnessVals)
    r['robustnessVar'] = np.var(robustnessVals)
    r['robustnessVals'] = robustnessVals
    return r

def calcRobustnessForDir(path='../cpp/out/3d', samplesPerPheno=100):
    confs = glob.glob(os.path.join(path, '*.conf'))
    if len(confs)>1:
        raise IndexError("More than one config at provided path, please run merge script")
    conf = utils.readConf(confs[0])
    phenos = utils.loadPhenos(path)
    total = sum(p['count'] for p in phenos)
    print("Loaded {} phenotypes".format(total))
    robustnesses = []
    random.shuffle(phenos)
    for i, p in enumerate(phenos):
        robustnesses.append(calcPhenotypeRobustness(p,
            int(conf['nColors']),
            int(conf['nCubeTypes']),
            int(conf['nDimensions']),
            conf['assemblyMode'],
            samplesPerPheno
        ))
        print("Progress: {:n}% ({} of {})".format(
            100*i/total, i, total),
            end="\r", flush=True
        )
        if i % 100 == 0 and i>0:
            pickle.dump(robustnesses, open(os.path.join(path, 'robustness.p'), 'wb'))
    return robustnesses


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", help='Path to directory containing phenotype directory')
    parser.add_argument("--samples", default=100, help='Max number of samples per phenotype')
    args = parser.parse_args()
    if args.path:
        data = calcRobustnessForDir(args.path, int(args.samples))
        pickle.dump(data, open(os.path.join(args.path, 'robustness.p'), 'wb'))
