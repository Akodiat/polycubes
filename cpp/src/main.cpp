#include <iostream>
#include <vector>
#include "polycubeSystem.hpp"
#include <cmath>
#include <bitset>

std::vector<std::string> splitString(std::string s) {
    std::vector<std::string> list;
    for (size_t i=0; i<s.size(); i++) {
        if(s[i] == '[') {
            int parenCount = 0;
            int end = i;
            do {
                switch (s[end]) {
                    case ']': parenCount--; break;
                    case '[': parenCount++; break;
                }
                if (end >= s.size()) {
                    end = s.size();
                    break;
                }
                end++;
            } while (parenCount);
            i++;
            list.push_back(s.substr(i, end-i-1));
            i = end;
        } else if (s[i] != ',') {
            size_t i_a = s.find(',', i);
            if(i_a == std::string::npos) i_a = s.size();
            size_t i_b = s.find(']', i);
            if(i_b == std::string::npos) i_b = s.size();
            size_t end = fmin(i_a, i_b);
            list.push_back(s.substr(i, end-i));
            i = end;
        }
    }
    return list;
}

Eigen::Vector3f getOrientation(int index, int orientation) {
    Eigen::Vector3f v;
    switch (index) {
        case 0: v = Eigen::Vector3f( 0,-1, 0); break;
        case 1: v = Eigen::Vector3f( 0, 1, 0); break;
        case 2: v = Eigen::Vector3f( 0, 0,-1); break;
        case 3: v = Eigen::Vector3f( 0, 0, 1); break;
        case 4: v = Eigen::Vector3f(-1, 0, 0); break;
        case 5: v = Eigen::Vector3f( 1, 0, 0); break;
    default:
        break;
    }
    const std::vector<Eigen::Vector3f> ruleOrder = PolycubeSystem::getRuleOrder();
    const Eigen::Vector3f dir = ruleOrder[index];
    const float angle = ((float) orientation) * M_PI_2;
    Eigen::AngleAxis<float> a = Eigen::AngleAxis<float>(
        angle, dir
    );
    Eigen::Quaternion<float> q = Eigen::Quaternion<float>(a);
    return (q*v);
}
// 0 sign
// 0 value 16
// 0 value 8
// 0 value 4

// 0 value 2
// 0 value 1
// 0 face orientation
// 0 face orientation

// 32 possible values (colours)
// Need 2 hexadecimal digits.

std::vector<Rule> parseRules(std::string ruleStr) {
    std::vector<Rule> rules;
    for(size_t i = 0; i<ruleStr.size(); i+=2*ruleSize) {
        Rule rule;
        std::cout<<"Rule "<<(i/(2*ruleSize))+1<<std::endl;
        for(size_t j = 0; j<ruleSize; j++) {
            std::string s = ruleStr.substr(i+(2*j), 2);
            int hex = std::stoi(s, 0, 16);
            std::bitset<8> bitset(hex);
            std::bitset<8> colorMask(0b01111100);
            std::bitset<8> orientationMask(0b00000011);
            int color = ((bitset & colorMask) >> 2).to_ulong();
            if(bitset[7]) color *= -1; // Why is there no .to_long()?
            int orientation = (bitset & orientationMask).to_ulong();
            std::cout<<"Colour: "<<color<<"\t Orientation: "<<orientation<<std::endl;
            rule[j] = new Face(color, getOrientation(j, orientation));
        }
        rules.push_back(rule);
        std::cout<<std::endl;
    }
    return rules;
}
int main(int argc, char** argv) {
    std::cout<<"Welcome to polycubes!"<<std::endl;

    if(argc > 1) {
        std::vector<Rule> rules = parseRules(argv[1]);
        std::cout<<"Rules parsed"<<std::endl;
        PolycubeSystem p(rules);
        std::cout<<"Initialized"<<std::endl;
        p.addCube(Eigen::Vector3f(0,0,0), rules[0], 0);
        std::cout<<"Added cube"<<std::endl;
        p.processMoves();
        std::cout<<"All moves processed"<<std::endl;
    }

    return 0;
}