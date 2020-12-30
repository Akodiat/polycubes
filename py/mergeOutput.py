import polycubes
import utils
import os
import re
import pickle
import sys

def mergeOutput(nmerdir, pid):
    for root, _, conffiles in os.walk(os.path.dirname(os.path.abspath(nmerdir))):
        confs = [utils.readConf(os.path.join(root, c)) for c in conffiles if ".conf" in c]
        break

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
                    'phenos': utils.getRulesFromPheno(os.path.join(root, phenoFile))
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
                    polycubes.checkEquality(p['phenos'][0], group['phenos'][0], confs[0]['assemblyMode'])
                ):
                    foundGroup = True
                    group['phenos'].extend(p['phenos'])
                    group['pIDs'].append(p['pID'])
                    break
            if not foundGroup:
                groups.append({
                    'phenos': p['phenos'],
                    'pIDs': [p['pID']]
                })
        for i, group in enumerate(groups):
            with open(os.path.join(nmerdir, "pheno_{}_{}_{}".format(sizeId, i, pid)), "w") as f:
                for rule in group['phenos']:
                    f.write(rule+'\n')

if __name__ == "__main__":
    if len(sys.argv) > 2:
        mergeOutput(sys.argv[1], sys.argv[2])
    else:
        print("Please provide a path to an n-mer directory and an id")
