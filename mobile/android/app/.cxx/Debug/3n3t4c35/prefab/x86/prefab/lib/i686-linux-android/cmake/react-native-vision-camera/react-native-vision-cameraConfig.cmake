if(NOT TARGET react-native-vision-camera::VisionCamera)
add_library(react-native-vision-camera::VisionCamera INTERFACE IMPORTED)
set_target_properties(react-native-vision-camera::VisionCamera PROPERTIES
    INTERFACE_INCLUDE_DIRECTORIES "/Users/3dzx/Downloads/PetApp/mobile/node_modules/react-native-vision-camera/android/build/headers/visioncamera"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

