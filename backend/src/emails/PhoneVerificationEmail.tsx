import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";

interface PhoneVerificationEmailProps {
  userName?: string;
}

export function PhoneVerificationEmail({ userName = "there" }: PhoneVerificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your phone number on TapaRide</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logo}>🚌 TapaRide</Text>
          </Section>
          <Heading style={heading}>Verify Your Phone Number</Heading>
          <Text style={text}>
            Hi {userName},
          </Text>
          <Text style={text}>
            To keep your account secure and enable transactions (booking trips, sending parcels, 
            and wallet top-ups), please verify your phone number.
          </Text>
          <Text style={text}>
            You'll receive an SMS with a 6-digit verification code on your registered phone number.
          </Text>
          <Section style={footerSection}>
            <Text style={footerText}>
              © 2025 TapaRide Rwanda · Made in Kigali
            </Text>
            <Text style={footerText}>
              Need help? Contact us at support@taparide.rw
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f5f4ff",
  fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const container = {
  margin: "0 auto",
  padding: "40px 20px",
  maxWidth: "480px",
};

const logoSection = {
  textAlign: "center" as const,
  marginBottom: "32px",
};

const logo = {
  fontSize: "24px",
  fontWeight: "700",
  color: "#10075c",
};

const heading = {
  fontSize: "24px",
  fontWeight: "700",
  color: "#1d1d1f",
  margin: "0 0 24px",
  textAlign: "center" as const,
};

const text = {
  fontSize: "16px",
  lineHeight: "24px",
  color: "#424245",
  margin: "0 0 16px",
};

const footerSection = {
  marginTop: "40px",
  paddingTop: "24px",
  borderTop: "1px solid #e5e5e7",
  textAlign: "center" as const,
};

const footerText = {
  fontSize: "12px",
  lineHeight: "18px",
  color: "#86868b",
  margin: "4px 0",
};

export default PhoneVerificationEmail;