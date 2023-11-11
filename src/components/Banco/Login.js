import GoogleLogin from "react-google-login";

const clientId = "99960275074-f5d0bnogv6a9oq1ui4pkrbou60ffh43f.apps.googleusercontent.com";


function Login(){

    return(

        <div id='signInButton'>
            <GoogleLogin 

                clientId={clientId}
                buttonText = "Login com Google"
                onSuccess={onSuccess}
                onFailure={onFailure}
                cookiePolicy={'single_host_origin'}
                isSignedIn={true}
            
            />


        </div>


    )
}


export default Login;