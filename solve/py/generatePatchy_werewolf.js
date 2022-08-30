// Paste this in the web console to generate patchy particle simulation files
[{
    name: 'human',
    r: '00000e040f0c88880000120000008f1600000000000b1400938700000000000000000096'
},{
    name: 'wolf',
    r: '04000909000c0013000009098a00001400000000000009840000938c0000000000009700'
},{
    name: 'werewolf',
    r: '11051013000018001d1d0008001700001d1da1001d1d00009e00000c0000000000000d93000000001d98000000002284000097880000000000008f00'
}].forEach(e=>getPatchySimFiles(e.r !== undefined ? parseHexRule(e.r) : parseDecRule(e.dr), 10, e.name, undefined, [.01,.02,.03,.04,.05,.06,.07,.08,.09,.1], 0.1, [0,1,2,3,4], true))