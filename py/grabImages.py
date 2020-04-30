#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Sun Mar 29 12:12:48 2020

@author: joakim
"""

import base64
import time
from selenium import webdriver
import pickle
import os

# https://stackoverflow.com/a/38318578
def grabRules(rules, savepath):
    browser = webdriver.Firefox()
    
    for rule in rules:
        browser.get('https://akodiat.github.io/polycubes/view?hexRule={}'.format(rule))
        
        time.sleep(3)
        
        canvas = browser.find_element_by_id('threeCanvas')
        
        # get the canvas as a PNG base64 string
        canvas_base64 = browser.execute_script("fitCamera(); return arguments[0].toDataURL('image/png').substring(21);", canvas)
        
        # decode
        canvas_png = base64.b64decode(canvas_base64)
        
        # save to a file
        with open(os.path.join(savepath,"rule_{}.png".format(rule)), 'wb') as f:
            f.write(canvas_png)
    
    browser.quit()
    
phenos = pickle.load(open('../cpp/out_3d/phenos_1.0E+09_rules_out_3d.p', "rb"))


for n in phenos:
    if len(phenos[n]) > 0:
        path = os.path.join(os.getcwd(),'img','{}-mer'.format(n))
        os.makedirs(path)
        grabRules((p['rule'] for p in phenos[n]), path)
    
