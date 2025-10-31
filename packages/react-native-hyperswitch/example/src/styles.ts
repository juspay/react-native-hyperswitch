import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  textInput: {
    display: 'flex',
    flexDirection: 'column',
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 36,
    fontSize: 24,
    paddingHorizontal: 20,
    width: '100%',
    backgroundColor: 'white',
    // color: '',
  },
  button: {
    width: '100%',
    height: 48,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
  },
  buttonText: {
    fontSize: 18,
    color: 'white',
  },
  status: {
    marginVertical: 32,
    gap: 12,
  },
  statusText: {
    fontSize: 24,
    color: 'blue',
    textAlign: 'center',
  },
  messageText: {
    fontSize: 18,
    color: 'blue',
    textAlign: 'center',
  },
});
