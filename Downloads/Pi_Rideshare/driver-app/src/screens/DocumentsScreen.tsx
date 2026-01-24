/**
 * DocumentsScreen - Upload driver documents (Insurance & Registration)
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api.config';
import { StorageKeys } from '../constants/StorageKeys';

interface DocumentStatus {
  insurance: { uploaded: boolean; fileName?: string; uri?: string };
  registration: { uploaded: boolean; fileName?: string; uri?: string };
}

const DocumentsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentStatus>({
    insurance: { uploaded: false },
    registration: { uploaded: false },
  });

  useEffect(() => {
    checkVerificationStatus();
  }, []);

  const checkVerificationStatus = async () => {
    try {
      const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/drivers/verification-status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.documents) {
          setDocuments({
            insurance: {
              uploaded: !!data.documents.insuranceImage,
              fileName: data.documents.insuranceImage?.fileName,
            },
            registration: {
              uploaded: !!data.documents.registrationImage,
              fileName: data.documents.registrationImage?.fileName,
            },
          });
        }
      }
    } catch (error) {
      console.log('Error checking verification status:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (documentType: 'insurance' | 'registration') => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadDocument(documentType, result.assets[0]);
    }
  };

  const takePhoto = async (documentType: 'insurance' | 'registration') => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your camera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadDocument(documentType, result.assets[0]);
    }
  };

  const showImageOptions = (documentType: 'insurance' | 'registration') => {
    Alert.alert(
      'Upload Document',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: () => takePhoto(documentType) },
        { text: 'Choose from Library', onPress: () => pickImage(documentType) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const uploadDocument = async (
    documentType: 'insurance' | 'registration',
    imageAsset: ImagePicker.ImagePickerAsset
  ) => {
    setUploading(documentType);

    try {
      const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
      if (!token) {
        Alert.alert('Error', 'Please log in again');
        return;
      }

      const formData = new FormData();
      const fieldName = documentType === 'insurance' ? 'insuranceImage' : 'registrationImage';
      
      formData.append(fieldName, {
        uri: imageAsset.uri,
        type: 'image/jpeg',
        name: `${documentType}_${Date.now()}.jpg`,
      } as any);

      const response = await fetch(`${API_BASE_URL}/api/drivers/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (response.ok) {
        setDocuments(prev => ({
          ...prev,
          [documentType]: {
            uploaded: true,
            uri: imageAsset.uri,
            fileName: `${documentType}_document.jpg`,
          },
        }));
        Alert.alert('Success', `${documentType === 'insurance' ? 'Insurance' : 'Registration'} document uploaded!`);
      } else {
        const error = await response.json();
        Alert.alert('Upload Failed', error.message || 'Please try again');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload document. Please try again.');
    } finally {
      setUploading(null);
    }
  };

  const getUploadedCount = () => {
    let count = 0;
    if (documents.insurance.uploaded) count++;
    if (documents.registration.uploaded) count++;
    return count;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6B46C1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Documents</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>📄</Text>
          <Text style={styles.infoTitle}>Document Requirements</Text>
          <View style={styles.requirementsList}>
            <Text style={styles.requirement}>• Documents must be current and valid</Text>
            <Text style={styles.requirement}>• Photos should be clear and readable</Text>
            <Text style={styles.requirement}>• Insurance must show name and coverage dates</Text>
            <Text style={styles.requirement}>• Registration must match vehicle info</Text>
            <Text style={styles.requirement}>• Accepted formats: JPG, PNG (max 10MB)</Text>
          </View>
        </View>

        {/* Document Cards */}
        <View style={styles.documentsContainer}>
          {/* Insurance Card */}
          <View style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <Text style={styles.documentIcon}>🛡️</Text>
              <View style={styles.documentInfo}>
                <Text style={styles.documentTitle}>Insurance Document</Text>
                <Text style={styles.documentSubtitle}>Current auto insurance policy</Text>
              </View>
              {documents.insurance.uploaded && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>
            
            {documents.insurance.uri && (
              <Image source={{ uri: documents.insurance.uri }} style={styles.previewImage} />
            )}
            
            <TouchableOpacity
              style={[
                styles.uploadButton,
                documents.insurance.uploaded && styles.uploadButtonUploaded,
              ]}
              onPress={() => showImageOptions('insurance')}
              disabled={uploading === 'insurance'}
            >
              {uploading === 'insurance' ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.uploadButtonText}>
                  {documents.insurance.uploaded ? 'Update Insurance' : 'Upload Insurance Document'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Registration Card */}
          <View style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <Text style={styles.documentIcon}>🚗</Text>
              <View style={styles.documentInfo}>
                <Text style={styles.documentTitle}>Vehicle Registration</Text>
                <Text style={styles.documentSubtitle}>Current vehicle registration</Text>
              </View>
              {documents.registration.uploaded && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>
            
            {documents.registration.uri && (
              <Image source={{ uri: documents.registration.uri }} style={styles.previewImage} />
            )}
            
            <TouchableOpacity
              style={[
                styles.uploadButton,
                documents.registration.uploaded && styles.uploadButtonUploaded,
              ]}
              onPress={() => showImageOptions('registration')}
              disabled={uploading === 'registration'}
            >
              {uploading === 'registration' ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.uploadButtonText}>
                  {documents.registration.uploaded ? 'Update Registration' : 'Upload Vehicle Registration'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Upload Progress</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressItem}>
              <View style={[
                styles.progressDot,
                documents.insurance.uploaded && styles.progressDotComplete
              ]} />
              <Text style={styles.progressLabel}>Insurance</Text>
            </View>
            <View style={styles.progressLine} />
            <View style={styles.progressItem}>
              <View style={[
                styles.progressDot,
                documents.registration.uploaded && styles.progressDotComplete
              ]} />
              <Text style={styles.progressLabel}>Registration</Text>
            </View>
          </View>
          <Text style={styles.progressCount}>{getUploadedCount()}/2 documents uploaded</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { padding: 8, marginRight: 8 },
  backIcon: { fontSize: 24, color: '#1F2937' },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#1F2937' },
  scrollView: { flex: 1, padding: 16 },
  infoCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  infoIcon: { fontSize: 32, textAlign: 'center', marginBottom: 8 },
  infoTitle: { fontSize: 16, fontWeight: '600', color: '#4338CA', textAlign: 'center', marginBottom: 12 },
  requirementsList: { gap: 4 },
  requirement: { fontSize: 13, color: '#4338CA', lineHeight: 20 },
  documentsContainer: { gap: 16 },
  documentCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  documentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  documentIcon: { fontSize: 32, marginRight: 12 },
  documentInfo: { flex: 1 },
  documentTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  documentSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  checkmark: { fontSize: 24, color: '#10B981' },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
  },
  uploadButton: {
    backgroundColor: '#6B46C1',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  uploadButtonUploaded: { backgroundColor: '#10B981' },
  uploadButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  progressCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  progressTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 16 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  progressItem: { alignItems: 'center' },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
  },
  progressDotComplete: { backgroundColor: '#10B981' },
  progressLabel: { fontSize: 12, color: '#6B7280' },
  progressLine: { width: 60, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 16 },
  progressCount: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 12 },
});

export default DocumentsScreen;