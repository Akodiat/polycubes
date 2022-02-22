import os
import re
import altair as alt
import pandas as pd

colordomain = ['Solution', 'None', 'UND', 'MEM']
colorrange = ['#4DAF4A', '#E41A1C', '#377EB8', '#170EB8']

alt.data_transformers.disable_max_rows()

def isNumber(s):
    try:
        float(s)
        return True
    except ValueError:
        return False

def getResults(shape, getInProgress=False, getCancelled=False):
    for root, _, fs in os.walk(shape):
        files =  [os.path.join(root, f) for f in fs]
        break
    results = []
    inProgressCounter = 0
    cancelledCounter = 0
    for path in files:
        with open(path) as f:
            lines = f.readlines()
        
        duration=None
        m = re.search('Total run time : (\d+) Hours (\d+) Minutes (\d+) Seconds', lines[-2])
        if m:
            duration = 60*(60*float(m.group(1)) + float(m.group(2))) + float(m.group(3))
            
        nVars = nClauses = None
        if len(lines) > 8:
            m = re.search('Using (\d+) variables and (\d+) clauses', lines[8])
        if m:
            nVars = int(m.group(1))
            nClauses = int(m.group(2))
        
        result = lines[-7].strip()
        if result == '=========================================================':
            inProgressCounter += 1
            if not getInProgress:
                continue
            result = 'In progress'
        if result.startswith('Job submitted date = '):
            cancelledCounter += 1
            if not getCancelled:
                continue
            result = "Cancelled"
        if result == '---------------' or result == "Job output ends":
            result = 'Error'
        category = result
            
        if not result in ['Cancelled', 'UND', 'None', 'Error', 'TIMEOUT', 'In progress']:
            category = 'Solution'
            ratio = 1.0
        else:
            ratio = 0.0
            
        if isNumber(result):
            ratio = float(result)
            category = 'UND'
            
        if 'out-of-memory' in lines[-1]:
            category = 'MEM'

        m = re.search('([0-9]+)t_([0-9]+)c-([0-9]+).out', path)
        #m.group(0)
        results.append({
            'nCubeTypes': int(m.group(1)),
            'nColors': int(m.group(2)),
            'jobID': int(m.group(3)),
            'duration': duration,
            'variables': nVars,
            'clauses': nClauses,
            'result': result,
            'category': category,
            'ratio': ratio
        })
    df = pd.DataFrame(results)
    df.to_csv(shape+'.csv')
    print("Found {} in progress and {} cancelled".format(inProgressCounter, cancelledCounter))
    return df

def plotData(df):
    base = alt.Chart(df).transform_calculate(
        url='https://akodiat.github.io/polycubes?rule=' + alt.datum.result
    )
    return base.mark_rect().encode(
        alt.X('nCubeTypes:O', title='# of species'),
        alt.Y('nColors:O', title='# of colors', sort='-y'),
        color=alt.Color('category', scale=alt.Scale(domain=colordomain, range=colorrange)),
        href='url:N'
    ) + base.mark_circle(color='black', opacity=0.5).encode(
        alt.X('nCubeTypes:O', title='# of species'),
        alt.Y('nColors:O', title='# of colors', sort='-y'),
        size=alt.Size('ratio:Q'),
        tooltip=['result', 'nCubeTypes', 'nColors', 'jobID', 'ratio', 'duration'],
        href='url:N'
    )