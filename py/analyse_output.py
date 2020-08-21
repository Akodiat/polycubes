import os
import sys
import pickle
import numpy as np
import re
import multiprocessing
import polycubes
import pathlib
import utils

def readResult(filename):
    result = {}
    nMers = {}
    nMerPat = r'(\d+)-mer'
    with open(filename) as f:
        for line in f:
            rule, suffix = line.strip('\n').split('.')
            nMer = re.search(nMerPat, suffix)
            if nMer is not None:
                n = int(nMer.group(1))
                if n not in nMers:
                    nMers[n] = []
                    print(n, end=' ', flush=True)
                nMers[n].append(rule)
            else:
                if suffix not in result:
                    result[suffix] = 0
                result[suffix] += 1
    result['nMers'] = nMers
    return result

def calcNRulesTested(result):
    nRules = 0
    categories = {}
    for cat, val in result.items():
        if cat == 'nMers':
            for n, rules in val.items():
                if n not in categories:
                    categories[n] = 0
                categories[n] += len(rules)
                nRules += categories[n]
        else:
            categories[cat] = val
            nRules += val
    return [nRules, categories]

def groupByPhenotype(rules):
    groups = []
    for rule in rules:
        foundGroup = False
        for group in groups:
            if polycubes.checkEquality(rule, group[0]):
                group.append(rule)
                foundGroup = True
                break
        if not foundGroup:
            groups.append([rule])
    return groups

def getPhenosForNMer(n):
    phenosn = []
    if(n==2):
        groups = [nMers[n]] # Only one phenotype possible
    else:
        groups = groupByPhenotype(nMers[n])
    pickle.dump(groups, open(
        os.path.join(datadir, "{}-mer_phenos_{}.p".format(n, suffix)), "wb")
    )
    for group in groups:
        count = len(group)
        minRule = min(group, key=utils.calcComplexity)
        minCompl = utils.calcComplexity(minRule)
        phenosn.append({
            'count': count,
            'compl': minCompl,
            'rule': minRule,
            'freq': count/nRules
        })
        print("{}-mer has {} phenos like {} (compl {})".format(n, count, minRule, minCompl), flush=True)
    return (n, phenosn)

phenos = {}
def calcPhenos():
    global phenos
    phenos = {}
    with multiprocessing.Pool(8) as p:
        for n, phenosn in p.imap_unordered(
                getPhenosForNMer,
                reversed(sorted([k for k in nMers.keys() if k != 1]))):
            print("{} phenotypes of {}-mers".format(len(phenosn), n), flush=True)
            phenos[n] = phenosn

if __name__ == "__main__":
    datapath = sys.argv[1]
    datadir, name = os.path.split(datapath)
    result = readResult(datapath)
    print("...Done reading data")

    nRules, categories = calcNRulesTested(result)
    suffix = '{:.1E}_rules_{}'.format(nRules, name)

    nMers = result['nMers']

    pathlib.Path(os.path.join(datadir, 'nmers')).mkdir(parents=True, exist_ok=True)
    for n, nMer in nMers.items():
        pickle.dump(nMer, open(os.path.join(datadir, 'nmers', "{}-mers_{}.p".format(n, suffix)), "wb"))

    print("Loaded {} rules in total".format(nRules))


