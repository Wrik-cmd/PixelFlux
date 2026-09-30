export const handler = async (event) => {

    console.log("Upload Lambda triggered");

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: "Upload Lambda working"
        })
    };
};