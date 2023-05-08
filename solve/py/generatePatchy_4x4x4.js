// Paste this in the web console to generate patchy particle simulation files
[{
    name: 'cube4_full',
    dr: '|-3:2||-7:1|1:2|2:0_3:0|4:0||-23:1|5:2|6:0_|-21:2|7:1|8:1|9:2|10:0_|-27:2||-41:1||-1:0_|-12:2||-15:1|-2:2|11:0_12:0|13:0||-33:1|-6:2|14:0_|-31:2|15:1|16:1|-10:2|17:0_|-36:2||-59:1|-11:2|_-4:2|18:0||-44:1|19:2|20:0_21:0|22:0|23:1|24:1|25:2|26:0_27:0|28:0||-55:1||-5:0_-13:2|29:0||-62:1|-20:2|30:0_31:0|32:0|33:1|34:1|-26:2|35:0_36:0|37:0||-71:1|-14:2|_|-48:2|-8:1|38:1|39:2|40:0_|-53:2|41:1|42:1||-9:0_-22:2|43:0|44:1|45:1|46:2|47:0_48:0|49:0|-24:1|50:1|51:2|52:0_53:0|54:0|55:1|56:1||-25:0_|-65:2|-16:1|57:1|-40:2|58:0_|-69:2|59:1|60:1|-17:2|_-32:2|61:0|62:1|63:1|-47:2|64:0_65:0|66:0|-34:1|67:1|-52:2|68:0_69:0|70:0|71:1|72:1|-35:2|_-18:2|||-81:1|73:2|74:0_-28:2|75:0||-90:1||-19:0_-29:2|||-92:1|-74:2|76:0_-37:2|77:0||-79:1|-30:2|_-77:2|||-102:1|-76:2|_-70:2|78:0|79:1|80:1|-64:2|_-43:2||81:1|82:1|83:2|84:0_-49:2|85:0|-45:1|86:1|87:2|88:0_-54:2|89:0|90:1|91:1||-46:0_-61:2||92:1|93:1|-84:2|94:0_-66:2|95:0|-63:1|96:1|-88:2|97:0_98:0|99:0|-72:1|100:1|-68:2|_|-98:2|-60:1|101:1|-58:2|_-78:2||102:1|103:1|-94:2|_-99:2|104:0|-80:1|105:1|-97:2|_|-109:2|-38:1||106:2|107:0_|-113:2|-42:1|108:1||-39:0_109:0|110:0|-50:1||111:2|112:0_113:0|114:0|-56:1|115:1||-51:0_-85:2||-82:1|116:1|117:2|118:0_-110:2|119:0|-86:1||120:2|121:0_-114:2|122:0|-91:1|123:1||-87:0_|-125:2|-57:1||-107:2|124:0_125:0|126:0|-67:1||-112:2|127:0_-95:2||-93:1|128:1|-118:2|129:0_-126:2|130:0|-96:1||-121:2|131:0_|-132:2|-101:1||-124:2|_132:0|133:0|-100:1||-127:2|_-104:2||-103:1|134:1|-129:2|_-133:2|135:0|-105:1||-131:2|_-75:2|||-137:1||-73:0_-135:2||-134:1||-136:2|_-130:2||-128:1||-140:2|136:0_-89:2||137:1|138:1||-83:0_-119:2||-116:1||139:2|140:0_-122:2||-138:1|141:1||-117:0_|-142:2|-108:1|||-106:0_142:0|143:0|-115:1|||-111:0_-143:2|144:0|-123:1|||-120:0_-144:2||-141:1|||-139:0'
},{
    name: 'cube4',
    dr: '-1:2|-4:1|1:1|-4:1|-8:1|-4:1_-3:2|-4:2|-4:2|8:1|3:1|-4:0_9:1|7:3|4:1|0:0|-9:2|-5:0_6:3|2:1|5:1|0:0|0:0|-7:2_-7:0|0:0|-6:0|2:3|0:0|5:1_0:0|-2:1|0:0|-2:1|0:0|-2:1'
}].forEach(e=>getPatchySimFiles(e.r !== undefined ? parseHexRule(e.r) : parseDecRule(e.dr), 10, e.name, undefined, [.01,.02,.03,.04,.05,.06,.07,.08,.09,.1], 0.1, ['no_torsion',0,1], 5))