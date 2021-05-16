cmake_minimum_required(VERSION 3.13)
project(polycubes LANGUAGES CXX)

find_package(Python COMPONENTS Interpreter Development REQUIRED)
find_package(pybind11 CONFIG REQUIRED)
find_package (Eigen3 3.3 REQUIRED)


add_library(polycubes MODULE polycubesPython.cpp ../utils.cpp ../polycubeSystem.cpp)
target_link_libraries(polycubes PRIVATE pybind11::module Eigen3::Eigen)
set_target_properties(polycubes PROPERTIES CXX_VISIBILITY_PRESET "hidden" CUDA_VISIBILITY_PRESET "hidden")
