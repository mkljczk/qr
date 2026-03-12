import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  CssBaseline,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Radio,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from '@mui/material';
import { alpha, createTheme } from '@mui/material/styles';
import ContactsRoundedIcon from '@mui/icons-material/ContactsRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import QRCode from 'qrcode';

const STORAGE_KEY = 'qr_phones_v1';
const STORAGE_SELECTED = 'qr_selected_phone_v1';

const normalizePhone = (phone) => {
  let normalized = phone.replace(/\s+/g, '').replace(/-/g, '');
  normalized = normalized.replace(/(?!^)\+/g, '');
  return normalized.replace(/[^\d+]/g, '');
};

const extractPickupCode = (text) => {
  if (!text) {
    return '';
  }

  const exact = text.match(/kod\s*odbioru\s*[:\-]?\s*(\d{4,12})/i);
  if (exact) {
    return exact[1];
  }

  const fallback = text.match(/\b(\d{6})\b(?![\s\S]*\b\d{6}\b)/);
  return fallback ? fallback[1] : '';
};

const getInitialContacts = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (_err) {
    return [];
  }
};

const QrDisplay = ({ payload }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!payload) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#6b7280';
      ctx.font = '500 14px Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Brak danych do kodu QR', canvas.width / 2, canvas.height / 2);
      return;
    }

    QRCode.toCanvas(canvas, payload, {
      width: 320,
      margin: 1,
      color: {
        dark: '#111111',
        light: '#ffffff',
      },
    });
  }, [payload]);

  return (
    <Box
      sx={{
        width: 'min(82vw, 320px)',
        height: 'min(82vw, 320px)',
        mx: 'auto',
        bgcolor: '#fff',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        borderRadius: 2,
      }}
    >
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Box>
  );
};

const App = () => {
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'light',
          primary: { main: '#2f6f4f' },
          secondary: { main: '#526056' },
          background: { default: '#f6f8f6', paper: '#ffffff' },
        },
        typography: {
          fontFamily: 'Roboto, system-ui, sans-serif',
          h6: { fontWeight: 700 },
          subtitle1: { fontWeight: 700, letterSpacing: 0.1 },
        },
        components: {
          MuiCard: {
            styleOverrides: {
              root: {
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              },
            },
          },
          MuiTextField: {
            defaultProps: {
              variant: 'outlined',
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
              },
            },
          },
        },
      }),
    []
  );

  const sharedText = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('text') || '').trim();
  }, []);

  const isShareMode = Boolean(sharedText);
  const [nav, setNav] = useState('home');
  const [contacts, setContacts] = useState(getInitialContacts);
  const [selectedId, setSelectedId] = useState(localStorage.getItem(STORAGE_SELECTED) || '');
  const [editId, setEditId] = useState('');
  const [messageText, setMessageText] = useState(sharedText);
  const [nicknameInput, setNicknameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const pickupCode = useMemo(() => extractPickupCode(messageText), [messageText]);

  useEffect(() => {
    if (!contacts.some((item) => item.id === selectedId) && contacts[0]) {
      setSelectedId(contacts[0].id);
    }
  }, [contacts, selectedId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
    localStorage.setItem(STORAGE_SELECTED, selectedId || '');
  }, [contacts, selectedId]);

  useEffect(() => {
    const onInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onInstallPrompt);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    }
  }, []);

  const selectedContact = contacts.find((entry) => entry.id === selectedId) || null;
  const payload = selectedContact && pickupCode ? `P|${selectedContact.phone}|${pickupCode}` : '';

  const messageStatus = !messageText.trim()
    ? 'Wpisz wiadomość, aby wygenerować kod QR.'
    : !pickupCode
      ? 'Nie znaleziono kodu odbioru w tej wiadomości.'
      : 'Kod odbioru wykryty. Wybierz kontakt.';

  const resetEdit = () => {
    setEditId('');
    setNicknameInput('');
    setPhoneInput('');
  };

  const onSubmitContact = (event) => {
    event.preventDefault();
    const nickname = nicknameInput.trim();
    const phone = normalizePhone(phoneInput);
    if (!nickname || !phone) {
      return;
    }

    if (editId) {
      setContacts((prev) =>
        prev.map((entry) =>
          entry.id === editId ? { ...entry, nickname, phone } : entry
        )
      );
    } else {
      const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      setContacts((prev) => [{ id, nickname, phone }, ...prev]);
      setSelectedId(id);
    }

    resetEdit();
  };

  const onDeleteContact = (id) => {
    const next = contacts.filter((entry) => entry.id !== id);
    setContacts(next);
    if (selectedId === id) {
      setSelectedId(next[0] ? next[0].id : '');
    }
  };

  const onEditContact = (id) => {
    const contact = contacts.find((entry) => entry.id === id);
    if (!contact) {
      return;
    }
    setEditId(id);
    setNicknameInput(contact.nickname);
    setPhoneInput(contact.phone);
    setNav('contacts');
  };

  const onInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const HomeView = (
    <Stack spacing={1.5} sx={{ pb: isShareMode ? 2 : 10 }}>
      {!isShareMode ? (
        <Card elevation={0}>
          <CardContent>
            <Typography variant='subtitle1' sx={{ mb: 1 }}>
              Wiadomość
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label='Treść'
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              helperText={messageStatus}
            />
          </CardContent>
        </Card>
      ) : (
        <Card elevation={0}>
          <CardContent>
            <Typography variant='subtitle1' sx={{ mb: 1 }}>
              Udostępniona wiadomość
            </Typography>
            <Typography
              variant='body2'
              sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                p: 1.5,
                borderRadius: 2,
                bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
              }}
            >
              {messageText}
            </Typography>
          </CardContent>
        </Card>
      )}

      <Card elevation={0}>
        <CardContent>
          <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 0.5 }}>
            <Typography variant='subtitle1'>Zapisane numery</Typography>
            <Typography variant='caption' color='text.secondary'>
              {contacts.length}
            </Typography>
          </Stack>
          <List sx={{ maxHeight: 'min(42vh, 340px)', overflowY: 'auto', px: 0, pr: 0.5 }}>
            {contacts.length === 0 ? (
              <ListItem disableGutters>
                <ListItemText
                  primary='Brak zapisanych kontaktów'
                  secondary='Dodaj kontakt w zakładce Kontakty'
                />
              </ListItem>
            ) : (
              contacts.map((contact) => (
                <Box key={contact.id}>
                  <ListItemButton
                    selected={contact.id === selectedId}
                    onClick={() => setSelectedId(contact.id)}
                    sx={{
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      mb: 1,
                      px: 1.25,
                      '&.Mui-selected': {
                        bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                        borderColor: 'primary.main',
                      },
                    }}
                  >
                    <ListItemText primary={contact.nickname} secondary={contact.phone} />
                    <Radio checked={contact.id === selectedId} />
                  </ListItemButton>
                </Box>
              ))
            )}
          </List>
        </CardContent>
      </Card>

      <Card elevation={0}>
        <CardContent sx={{ textAlign: 'center' }}>
          <Typography variant='subtitle1' sx={{ mb: 1.5 }}>
            Kod QR
          </Typography>
          <QrDisplay payload={payload} />
        </CardContent>
      </Card>
    </Stack>
  );

  const ContactsView = (
    <Stack spacing={1.5} sx={{ pb: 10 }}>
      <Card elevation={0}>
        <CardContent>
          <Typography variant='subtitle1' sx={{ mb: 1 }}>
            Zarządzanie kontaktami
          </Typography>
          <Box component='form' onSubmit={onSubmitContact}>
            <Stack spacing={1.5}>
              <TextField
                label='Nazwa'
                value={nicknameInput}
                onChange={(event) => setNicknameInput(event.target.value)}
                required
              />
              <TextField
                label='Numer telefonu'
                value={phoneInput}
                onChange={(event) => setPhoneInput(event.target.value)}
                required
              />
              <Stack direction='row' spacing={1}>
                <Button type='submit' variant='contained'>
                  {editId ? 'Zapisz' : 'Dodaj kontakt'}
                </Button>
                {editId ? (
                  <Button type='button' onClick={resetEdit}>
                    Anuluj
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Card elevation={0}>
        <CardContent>
          <Typography variant='subtitle1'>Lista kontaktów</Typography>
          <List sx={{ maxHeight: 'min(48vh, 420px)', overflowY: 'auto', px: 0, pr: 0.5 }}>
            {contacts.length === 0 ? (
              <ListItem disableGutters>
                <ListItemText primary='Brak zapisanych kontaktów' />
              </ListItem>
            ) : (
              contacts.map((contact) => (
                <Box
                  key={contact.id}
                  sx={{
                    py: 1.25,
                    px: 1.25,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: selectedId === contact.id ? 'primary.main' : 'divider',
                    mb: 1,
                    bgcolor:
                      selectedId === contact.id
                        ? (t) => alpha(t.palette.primary.main, 0.08)
                        : 'background.paper',
                  }}
                >
                  <Typography variant='subtitle2' sx={{ fontWeight: 700 }}>
                    {contact.nickname}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {contact.phone}
                  </Typography>
                  <Stack direction='row' spacing={1} sx={{ mt: 1 }}>
                    <Button size='small' variant='outlined' onClick={() => onEditContact(contact.id)}>
                      Edytuj
                    </Button>
                    <Button size='small' color='error' variant='outlined' onClick={() => onDeleteContact(contact.id)}>
                      Usuń
                    </Button>
                  </Stack>
                </Box>
              ))
            )}
          </List>
        </CardContent>
      </Card>
    </Stack>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', pb: isShareMode ? 0 : '82px' }}>
        <Container maxWidth='sm' sx={{ pt: 1.5 }}>
          {isShareMode ? HomeView : nav === 'home' ? HomeView : ContactsView}

          {!pickupCode && messageText.trim() ? (
            <Alert severity='warning' sx={{ mb: 10, borderRadius: 3 }}>
              Nie udało się znaleźć kodu odbioru w wiadomości.
            </Alert>
          ) : null}
        </Container>

        {!isShareMode ? (
          <Paper
            elevation={8}
            sx={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              bgcolor: (t) => alpha(t.palette.background.paper, 0.9),
              backdropFilter: 'blur(8px)',
              pb: 'env(safe-area-inset-bottom)',
            }}
          >
            <Container maxWidth='sm' disableGutters>
              <BottomNavigation value={nav} onChange={(_event, value) => setNav(value)}>
                <BottomNavigationAction label='Kod' value='home' icon={<QrCode2RoundedIcon />} />
                <BottomNavigationAction label='Kontakty' value='contacts' icon={<ContactsRoundedIcon />} />
              </BottomNavigation>
            </Container>
          </Paper>
        ) : null}
      </Box>
    </ThemeProvider>
  );
};

export default App;
