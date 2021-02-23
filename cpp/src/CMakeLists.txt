set(
        polycube_source_files
        main.cpp
        polycubeSystem.cpp
        utils.cpp
        io.cpp
)

set(
        polycube_header_files
        polycubeSystem.hpp
        utils.hpp
        io.hpp
)


add_executable(polycubes ${polycube_source_files} ${polycube_header_files})
target_include_directories(polycubes INTERFACE ${CMAKE_CURRENT_SOURCE_DIR})


# Link Eigen
find_package (Eigen3 3.3 REQUIRED NO_MODULE)
target_link_libraries (polycubes Eigen3::Eigen)

# Link HDF5
#find_package (HDF5 REQUIRED)
#include_directories (${HDF5_INCLUDE_DIRS})
#set (HDF5_LIBS ${HDF5_LIBS} ${HDF5_LIBRARIES})

# Explicitely list required HDF5 components
find_package(HDF5 COMPONENTS CXX HL)

include_directories(${HDF5_INCLUDE_DIRS})
target_link_libraries(
    polycubes
    ${HDF5_LIBRARIES} # This should list all libraries.
)
