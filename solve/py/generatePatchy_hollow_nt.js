// Paste this in the web console to generate patchy particle simulation files
[{
    name: 'cube_full',
    r: '00040109020c000089110200001491010218000001018e1c002001259e000000a5290200002ca901b200000001019a30963401010200863801010200ba00013d02400000bd450200b600c5010248ae4c01010200ce00e101d20000000101ca5000000101c254de000159d600a25c010102000000d9610200'
},{
    name: 'cube',
    r: '070000070500868700000000'
},{
    name: 'cube_inter',
    r: '90000800000600040090000d000000008b8d000011860000'
},{
    name: 'filled_cube_full',
    dr: '|1:0||2:1||3:0_-1:2|4:0||5:1||6:0_|7:0|-2:1|8:1||9:0_|10:0||11:1|-3:2|12:0_-4:2|||13:1||14:0_-7:2|15:0|-5:1|16:1||17:0_-10:2|18:0||19:1|-6:2|20:0_-15:2||-13:1|21:1||22:0_-18:2|||23:1|-14:2|24:0_|25:0|-11:1|26:1|-9:2|27:0_|28:0||29:1|-12:2|_-25:2|30:0|-19:1|31:1|-17:2|32:0_-28:2|33:0||34:1|-20:2|_-30:2||-23:1|35:1|-22:2|36:0_-33:2|||37:1|-24:2|_|38:0|-29:1|39:1|-27:2|_-38:2|40:0|-34:1|41:1|-32:2|_-40:2||-37:1|42:1|-36:2|_|43:0|-8:1|||44:0_-43:2|45:0|-16:1|||46:0_-45:2||-21:1|||47:0_|48:0|-26:1||-44:2|49:0_-48:2|50:0|-31:1||-46:2|51:0_-50:2||-35:1||-47:2|52:0_|53:0|-39:1||-49:2|_-53:2|54:0|-41:1||-51:2|_-54:2||-42:1||-52:2|'
},{
    name: 'filled_cube_inter',
    dr: '4:0|4:0|4:1|4:3|8:3|8:3_-4:1|0:0|7:1|7:1|-3:0|9:0_0:0|-8:2|-5:0|-5:0|-5:1|-5:3_3:0|0:0|-9:1|0:0|6:3|6:2_5:3|0:0|0:0|-7:1|2:2|-1:1_-6:0|0:0|-2:2|0:0|1:0|0:0'
},{
    name: 'filled_cube',
    r: '0a0a0b0a0908878784868b00060000078e8f000c0c00000e'
}].forEach(e=>getPatchySimFiles(e.r !== undefined ? parseHexRule(e.r) : parseDecRule(e.dr), 10, e.name, undefined, [.01,.02,.03,.04,.05,.06,.07,.08,.09,.1], 0.1, ['no_torsion',0,1,2,3,4], 5))