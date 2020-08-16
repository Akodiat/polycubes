import os
import sys
import re
import pickle
import pathlib
import polycubes
from analyse_output import calcComplexity, simplifyHexRule

def groupByPhenotype(rules):
    nRules = len(rules)
    nGroups = 0
    print("About to group {} rules".format(nRules), flush=True)
    groups = []
    for i, rule in enumerate(rules):
        print("{} groups, {} rules grouped ({:.2}%)".format(nGroups, i, 100*i/nRules), end='\r', flush=True)
        foundGroup = False
        for group in groups:
            if polycubes.checkEquality(rule, group[0]):
                group.append(rule)
                foundGroup = True
                break
        if not foundGroup:
            groups.append([rule])
            nGroups += 1
        if i%10 == 0:
            groups.sort(key=lambda x: len(x), reverse=True) # Make sure most common is first
            #print([len(g) for g in groups[:10]])
    groups.sort(key=lambda x: len(x), reverse=True)
    return groups

def getPhenosForNMer(n, nmer, datadir):
    phenosn = []
    if(n==2):
        groups = [nmer] # Only one phenotype possible
    else:
        groups = groupByPhenotype(nmer)

    print("Found {} {}-mer phenotypes".format(len(groups), n), flush=True)
    for group in groups:
        count = len(group)
        minRule = min(group, key=calcComplexity)
        minCompl = calcComplexity(minRule)
        phenosn.append({
            'count': count,
            'freq': count/nRules,
            'compl': minCompl,
            'rule': simplifyHexRule(minRule),
            'genotypes': group
        })
        print("{}-mer has {} genotypes equal to {} (compl {})".format(n, count, minRule, minCompl), flush=True)

    pathlib.Path(os.path.join(datadir, 'phenos')).mkdir(parents=True, exist_ok=True)
    pickle.dump(phenosn, open(os.path.join(datadir, 'phenos', "{}-mer_phenos_{}.p".format(n, suffix)), "wb"))
    return (n, phenosn)

if __name__ == "__main__":
    nmerpath = sys.argv[1]
    nmerdir, nmername = os.path.split(nmerpath)
    p = r'(\d+)-mers_((.*)_rules_(.*)).p'
    r = re.search(p, nmername)
    n = int(r.group(1))
    suffix = r.group(2)
    nRules = float(r.group(3))
    datadir, _ = os.path.split(nmerdir)
    nmer = pickle.load(open(nmerpath, "rb"))
    getPhenosForNMer(n, nmer, datadir) 
