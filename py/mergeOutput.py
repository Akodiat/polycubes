import polycubes
import utils
import os
import re
import pickle
import sys

# Get just the first rule from pheno file
def getRuleFromPheno(path):
    with open(path) as f:
        return f.readline().strip()

def mergeOutput(nmerdir, pid):
    for r, _, cs in os.walk(os.path.dirname(os.path.abspath(nmerdir))):
        assemblyModes = set(utils.readConf(os.path.join(r, c))['assemblyMode'] for c in cs if ".conf" in c)
        break
    assert len(assemblyModes) == 1, "Incompatable assembly modes"
    assemblyMode = assemblyModes.pop()

    phenos = {}
    # For each phenotype file
    for root, _, phenoFiles in os.walk(nmerdir):
        for phenoFile in phenoFiles:
            r = re.search(r'pheno_(\d+_\d+,\d+,\d+)_(\d+)_(\d+)', phenoFile)
            if r: # If filename matches
                pheno = {
                    'sizeId': r.group(1),
                    'index': r.group(2),
                    'pID': r.group(3),
                    'rule': getRuleFromPheno(os.path.join(root, phenoFile)),
                    'path': os.path.join(root, 'merged', phenoFile)
                }
                if not pheno['sizeId'] in phenos:
                    phenos[pheno['sizeId']] = []
                phenos[pheno['sizeId']].append(pheno)
            os.renames(os.path.join(root, phenoFile), os.path.join(root, 'merged', phenoFile))
        break



    #phenosn = []
    # For all phenotypes with the same dimensions
    for sizeId, phenolist in phenos.items():
        groups = []
        for p in phenolist:
            foundGroup = False
            for group in groups:
                if (p['pID'] not in group['pIDs'] and 
                    polycubes.checkEquality(p['rule'], group['rule'], assemblyMode)
                ):
                    foundGroup = True
                    group['paths'].append(p['path'])
                    group['pIDs'].append(p['pID'])
                    break
            if not foundGroup:
                groups.append({
                    'paths': [p['path']],
                    'pIDs': [p['pID']],
                    'rule': p['rule']
                })
        for i, group in enumerate(groups):
            with open(os.path.join(nmerdir, "pheno_{}_{}_{}".format(sizeId, i, pid)), "wb") as f:
                for path in group['paths']:
                    with open(path, "rb") as toMerge:
                        f.write(toMerge.read())

if __name__ == "__main__":
    if len(sys.argv) > 2:
        mergeOutput(sys.argv[1], sys.argv[2])
    else:
        print("Please provide a path to an n-mer directory and an id")