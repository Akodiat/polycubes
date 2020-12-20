import polycubes
import utils
import os
import re
import pickle
import sys

def readConf(filename):
    conf = {}
    with open(filename) as f:
        for line in f:
            if len(line.strip()) > 0:
                key, val = [s.strip() for s in line.split('=')]
            conf[key] = val
    return conf

def readPheno(path):
    rules = []
    with open(path) as f:
        rules = [line.strip() for line in f]
    return rules

"""
count = len(group)
minNc, minNc_r, minNt, minNt_r, minLz, minLz_r = utils.getMinComplexity(group)
phenosn.append({
    'count': count,
    'freq': count/nRules,
    'minNc': minNc, 'minNc_r': minNc_r, # Min number of colors
    'minNt': minNt, 'minNt_r': minNt_r, # Min number of cube types
    'minLz': minLz, 'minLz_r': minLz_r, # Min Lempel-Ziv size
    'size': n,
    'genotypes': group
})
print("{}-mer has {} genotypes equal to {})".format(n, count, minNt_r), flush=True)
"""

def loadPhenos(nmerdir):
    print("Loading phenotypes from "+nmerdir)
    # Extract total number of sampled rules from configs in parent directory
    parentdir = os.path.dirname(os.path.abspath(nmerdir))
    for root, _, conffiles in os.walk(parentdir):
        confs = [readConf(os.path.join(root, c)) for c in conffiles if ".conf" in c]
        results = [readConf(os.path.join(root, c)) for c in conffiles if ".result" in c]
        try:
            nRules = sum(int(r['nTot']) for r in results)
        except:
            print("Warning, no nTot found in config (did the sampling exit correctly?). Frequency data will be invalid")
            nRules = -1
        break

    n = int(os.path.split(nmerdir)[-1].replace('-mers',''))
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
                    'phenos': readPheno(os.path.join(root, phenoFile))
                }
                if not pheno['sizeId'] in phenos:
                    phenos[pheno['sizeId']] = []
                phenos[pheno['sizeId']].append(pheno)
        break;
    
    phenosn = []
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
        for group in groups:
            count = len(group['phenos'])
            minNc, minNc_r, minNt, minNt_r, minLz, minLz_r = utils.getMinComplexity(group['phenos'])
            phenosn.append({
                'count': count,
                'freq': count/nRules,
                'minNc': minNc, 'minNc_r': minNc_r, # Min number of colors
                'minNt': minNt, 'minNt_r': minNt_r, # Min number of cube types
                'minLz': minLz, 'minLz_r': minLz_r, # Min Lempel-Ziv size
                'size': n,
                'sizeId': sizeId,
                'genotypes': group['phenos']
            })
    pickle.dump(phenosn, open(os.path.join(nmerdir, "{}-mer_phenos.p".format(n)), "wb"))
    return phenosn

if __name__ == "__main__":
    if len(sys.argv) > 1:
        path = sys.argv[1]
        loadPhenos(path)
    else:
        print("Please provide a path to an n-mer directory")
