import analyse_output as utils
import polycubes
import numpy as np
import pandas as pd
import os
import random
import pickle
from multiprocessing import Pool

# Enumerate all genotypes one point mutation away
def enumerateMutations(hexRule, maxColor=8, maxCubes=8, dim=3):
    emptyCube = "000000000000"
    orientations = range(4)
    colors = range(-maxColor, maxColor+1)
    # Pad with empty cubes
    while len(hexRule) < maxCubes * len(emptyCube):
        hexRule += emptyCube
        
    mutations = []
    rule = utils.parseHexRule(hexRule)
    for i, cube in enumerate(rule):
        for j, face in enumerate(cube):
            for color in colors:
                if color != face['color']:
                    newRule = utils.parseHexRule(hexRule)
                    newRule[i][j]['color'] = color
                    mutations.append(utils.ruleToHex(newRule))
            if dim == 3:
                for orientation in orientations:
                    if orientation != face['orientation']:
                        newRule = utils.parseHexRule(hexRule)
                        newRule[i][j]['orientation'] = orientation
                        mutations.append(utils.ruleToHex(newRule))
    return mutations

# Calculate the fraction of mutational neigbours that produce the same phenotype
def calcGenotypeRobustness(hexRule, maxColor=8, maxCubes=8, dim=3):
    mutations = enumerateMutations(hexRule, maxColor, maxCubes, dim)
    nEqual = sum(polycubes.checkEquality(hexRule, mutant) for mutant in mutations)
    return nEqual / len(mutations)

# Load all genotypes found to assemble each phenotype
def loadGroupedPhenos(path="../cpp/out/3d/phenos"):
    groupedPhenos = []
    for root, _, files in os.walk(path):
        for file in files:
            groupedPhenos.extend(pickle.load(open(os.path.join(root, file), "rb")))
    return groupedPhenos

def __f(arg):
    pheno, maxColor, maxCubes, dim, total = arg
    n = len(pheno)
    print(".", flush=True, end='')
    return {
        'rule': pheno[0],
        'robustness': sum(calcGenotypeRobustness(
            hexRule, maxColor, maxCubes, dim
            ) for hexRule in pheno) / n,
        'frequency': n / total
    }

def calcPhenotypeRobustness(path='../cpp/out/3d', maxColor=8, maxCubes=8, dim=3, sampleSize=0):
    phenos = loadGroupedPhenos(os.path.join(path,'phenos'))
    total = sum(len(pheno) for pheno in phenos)
    if sampleSize > 0:
        phenos = random.sample(phenos, sampleSize)
    else:
         sampleSize = total
    robustnesses = []
    for i, pheno in enumerate(phenos):
        n = len(pheno)
        robustnesses.append({
            'rule': pheno[0],
            'robustness': sum(calcGenotypeRobustness(
                hexRule, maxColor, maxCubes, dim
                ) for hexRule in pheno) / n,
            'frequency': n / total
        })
        print("Progress: {:n}% ({} of {})".format(100*i/sampleSize, i, sampleSize), end="\r", flush=True)
        if i % 100 == 0 and i>0:
            pickle.dump(pd.DataFrame(data=robustnesses), open(os.path.join(path, 'robustness.p'), 'wb'))
    data = pd.DataFrame(data=robustnesses)
    return data


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--path")
    parser.add_argument("--maxColor", default=8)
    parser.add_argument("--maxCubes", default=8)
    parser.add_argument("--dim", default=3)
    parser.add_argument("--sampleSize", default=0)
    args = parser.parse_args()
    if args.path:
        data = calcPhenotypeRobustness(args.path, int(args.maxColor), int(args.maxCubes), int(args.dim), int(args.sampleSize))
        pickle.dump(data, open(os.path.join(args.path, 'robustness.p'), 'wb'))

